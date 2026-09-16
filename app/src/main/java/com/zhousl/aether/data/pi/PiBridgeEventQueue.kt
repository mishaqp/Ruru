package com.zhousl.aether.data.pi

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
