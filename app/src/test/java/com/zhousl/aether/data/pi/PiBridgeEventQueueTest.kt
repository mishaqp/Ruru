package com.zhousl.aether.data.pi

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PiBridgeEventQueueTest {
    @Test
    fun slowConsumerCannotAccumulateUnboundedEvents() {
        val queue = createPiBridgeEventChannel<Int>()
        try {
            repeat(PiBridgeEventQueueCapacity) { assertTrue(queue.trySend(it).isSuccess) }
            assertTrue("Queue must reject overflow, not grow forever", queue.trySend(-1).isFailure)
            assertEquals(0, queue.tryReceive().getOrThrow())
            assertTrue(queue.trySend(999).isSuccess)
        } finally {
            queue.cancel()
        }
    }

    @Test
    fun queuedEventsAndFinalResponseKeepTheirOrder() = runBlocking {
        val queue = createPiBridgeEventChannel<String>()
        try {
            queue.send("tool-start")
            queue.send("tool-result")
            queue.send("final-response")
            queue.close()
            assertEquals(listOf("tool-start", "tool-result", "final-response"), buildList {
                for (item in queue) add(item)
            })
            assertTrue(queue.trySend("late").isClosed)
        } finally {
            queue.cancel()
        }
    }
}
