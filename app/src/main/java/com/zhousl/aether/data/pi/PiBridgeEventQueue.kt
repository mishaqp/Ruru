package com.zhousl.aether.data.pi

import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ChannelResult

internal const val PiBridgeEventQueueCapacity = 256
internal const val PiBridgeEventQueueOverflowCode = "event_queue_overflow"

/** Bounded FIFO: never block the shared stdout reader or silently drop frames. */
internal fun <T> newPiBridgeEventChannel(): Channel<T> = Channel(PiBridgeEventQueueCapacity)

internal fun piBridgeEventQueueFailure(result: ChannelResult<Unit>): PiBridgeException? = when {
    result.isSuccess -> null
    result.isClosed -> PiBridgeException("Pi bridge event queue was closed.", code = "event_queue_closed")
    else -> PiBridgeException(
        "Pi bridge event queue exceeded $PiBridgeEventQueueCapacity pending frames. The affected request was stopped; retry it.",
        code = PiBridgeEventQueueOverflowCode,
    )
}
