package com.zhousl.aether.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppUpdateManagerTest {
    @Test
    fun comparesSemanticVersions() {
        assertTrue(isVersionNewer("v1.2.1", "1.2.0"))
        assertTrue(isVersionNewer("2.0.0", "1.9.9"))
        assertFalse(isVersionNewer("1.2.0", "1.2.0"))
        assertFalse(isVersionNewer("1.1.9", "1.2.0"))
    }

    @Test
    fun comparesRuruRevisionsWithoutLosingTheTagSuffix() {
        assertEquals("0.1.0-ruru.2", "v0.1.0-ruru.2+build".releaseVersionName())
        assertTrue(isVersionNewer("v0.1.0-ruru.2", "0.1.0-ruru.1"))
        assertFalse(isVersionNewer("0.1.0-ruru.1", "0.1.0-ruru.2"))
        assertFalse(isVersionNewer("0.1.0-ruru.2", "0.1.0-ruru.2"))
        assertTrue(isVersionNewer("0.1.1-ruru.1", "0.1.0-ruru.99"))
        assertFalse(isVersionNewer("0.1.0-ruru.99", "0.2.0-ruru.1"))
    }

    @Test
    fun ignoresTagPrefixAndBuildMetadata() {
        assertTrue(isVersionNewer("V1.0.1+5", "1.0.0"))
        assertFalse(isVersionNewer("v1.0.0-beta01", "1.0.0"))
    }
}
