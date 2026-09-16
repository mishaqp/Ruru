from pathlib import Path

def edit(path, old, new):
    p = Path(path)
    s = p.read_text()
    if new in s:
        return
    assert s.count(old) == 1, (path, old[:100], s.count(old))
    p.write_text(s.replace(old, new))

p = Path('app/src/main/java/com/zhousl/aether/data/pi/PiBridgeEventQueue.kt')
p.write_text('''package com.zhousl.aether.data.pi

import kotlinx.coroutines.channels.Channel

// Bound event count per request. Individual frame size is a separate concern.
internal const val PiBridgeEventQueueCapacity = 1_024

internal fun <T> createPiBridgeEventChannel(): Channel<T> = Channel(PiBridgeEventQueueCapacity)

// Never suspend the shared stdout reader: a handler can be awaiting a host RPC
// whose response arrives on the same reader. Overflow is explicit, not dropped.
internal fun <T> offerPiBridgeEvent(queue: Channel<T>, value: T): String? {
    val result = queue.trySend(value)
    return when {
        result.isSuccess -> null
        result.isClosed -> "event_queue_closed"
        else -> "event_queue_overflow"
    }
}
''')

p = 'app/src/main/java/com/zhousl/aether/data/pi/PiKernelBridge.kt'
edit(p, '        startIfNeeded: Boolean = true,\n    ): JSONObject = withContext(Dispatchers.IO) {', '        startIfNeeded: Boolean = true,\n        expectedProcessGeneration: Long? = null,\n    ): JSONObject = withContext(Dispatchers.IO) {')
edit(p, '        val eventChannel = onEvent?.let { Channel<PiBridgeFrame>(Channel.UNLIMITED) }', '        val eventChannel = onEvent?.let { createPiBridgeEventChannel<PiBridgeFrame>() }\n        var requestGeneration: Long? = null')
edit(p, '            pendingRequests[id] = PendingPiBridgeRequest(', '''            if (expectedProcessGeneration != null && requestProcess.generation != expectedProcessGeneration) {
                throw PiBridgeException("Pi bridge process changed before request cleanup.", code = "process_generation_changed")
            }
            requestGeneration = requestProcess.generation
            pendingRequests[id] = PendingPiBridgeRequest(''')
edit(p, '''        } catch (throwable: Throwable) {
            diagnosticLogger.exception(
                category = "pi_bridge",
                event = "request_failed",''', '''        } catch (throwable: Throwable) {
            if (throwable is PiBridgeException && throwable.code == "event_queue_overflow") {
                markRequestCancelled(id)
                eventChannel?.cancel()
                eventJob?.cancel()
                val generation = requestGeneration
                val cleanupType = when {
                    abortOnCancellation -> "abort"
                    type == "subscribe_aether_extensions" -> "unsubscribe_aether_extensions"
                    else -> null
                }
                if (generation != null && cleanupType != null) {
                    withContext(NonCancellable) {
                        runCatching {
                            // Exact request only: never abort a newer turn by session id,
                            // and never start a replacement Node process just to cancel.
                            request(
                                type = cleanupType,
                                payload = JSONObject().put("request_id", id),
                                timeoutMillis = PiBridgePingTimeoutMillis,
                                abortOnCancellation = false,
                                startIfNeeded = false,
                                expectedProcessGeneration = generation,
                            )
                        }.onFailure { cleanupError ->
                            diagnosticLogger.exception(
                                category = "pi_bridge",
                                event = "overflow_cleanup_failed",
                                throwable = cleanupError,
                                requestId = id,
                            )
                        }
                    }
                }
            }
            diagnosticLogger.exception(
                category = "pi_bridge",
                event = "request_failed",''')
edit(p, '            eventChannel?.close()\n            eventJob?.cancelAndJoin()', '            eventChannel?.cancel()\n            eventJob?.cancelAndJoin()')
edit(p, '''        when {
            pending != null && pending.eventChannel != null -> {
                if (pending.eventChannel.trySend(frame).isFailure) {''', '''        when {
            pending?.response?.isCompleted == true -> Unit
            pending != null && pending.eventChannel != null -> {
                val queueError = offerPiBridgeEvent(pending.eventChannel, frame)
                if (queueError != null) {''')
edit(p, '                        PiBridgeException("Pi bridge event queue was closed.", code = "event_queue_closed")', '''                        PiBridgeException(
                            if (queueError == "event_queue_overflow")
                                "Pi bridge event queue overflowed; the request was stopped. Retry the operation."
                            else "Pi bridge event queue was closed.",
                            code = queueError,
                        )''')

p = 'app/src/test/java/com/zhousl/aether/data/pi/PiBridgeEventQueueTest.kt'
edit(p, 'class PiBridgeEventQueueTest {', '''class PiBridgeEventQueueTest {
    @Test
    fun overflowAndClosedQueuesHaveDistinctErrors() {
        val queue = createPiBridgeEventChannel<Int>()
        try {
            repeat(PiBridgeEventQueueCapacity) { assertEquals(null, offerPiBridgeEvent(queue, it)) }
            assertEquals("event_queue_overflow", offerPiBridgeEvent(queue, -1))
            queue.cancel()
            assertEquals("event_queue_closed", offerPiBridgeEvent(queue, -1))
        } finally {
            queue.cancel()
        }
    }
''')
print('Applied bounded FIFO + explicit overflow cleanup. No Nightly or signing changes.')
