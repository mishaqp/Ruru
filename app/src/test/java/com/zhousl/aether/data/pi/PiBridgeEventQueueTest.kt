package com.zhousl.aether.data.pi

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PiBridgeEventQueueTest {
    @Test
    fun slowConsumerCannotGrowTheQueueWithoutBound() {
        val queue = newPiBridgeEventChannel<Int>()
        try {
            repeat(PiBridgeEventQueueCapacity) { assertTrue(queue.trySend(it).isSuccess) }
            assertTrue("full event queue must reject immediately", queue.trySend(999).isFailure)
        } finally { queue.cancel() }
    }

    @Test
    fun overflowDoesNotSilentlyDropOlderEvents() {
        val queue = newPiBridgeEventChannel<Int>()
        try {
            repeat(PiBridgeEventQueueCapacity) { assertTrue(queue.trySend(it).isSuccess) }
            assertTrue(queue.trySend(-1).isFailure)
            repeat(PiBridgeEventQueueCapacity) { assertEquals(it, queue.tryReceive().getOrThrow()) }
            assertTrue(queue.tryReceive().isFailure)
        } finally { queue.cancel() }
    }

    @Test
    fun normalEventsAndFinalResponseKeepTheirOrder() {
        val queue = newPiBridgeEventChannel<String>()
        try {
            val events = listOf("text_delta", "host_tool_call", "tool_result", "response")
            events.forEach { assertTrue(queue.trySend(it).isSuccess) }
            assertEquals(events, events.map { queue.tryReceive().getOrThrow() })
        } finally { queue.cancel() }
    }

    @Test
    fun closedQueueIsDistinguishableFromOverload() {
        val queue = newPiBridgeEventChannel<String>()
        queue.close()
        val result = queue.trySend("response")
        assertTrue(result.isClosed)
        assertFalse(result.isSuccess)
    }
}
