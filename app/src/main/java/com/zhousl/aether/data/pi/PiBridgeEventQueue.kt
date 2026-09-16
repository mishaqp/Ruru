package com.zhousl.aether.data.pi

import kotlinx.coroutines.channels.Channel

internal const val PiBridgeEventQueueCapacity = 256

// Extracted unchanged first so the regression demonstrates the old unbounded policy.
internal fun <T> createPiBridgeEventChannel(): Channel<T> = Channel(Channel.UNLIMITED)
