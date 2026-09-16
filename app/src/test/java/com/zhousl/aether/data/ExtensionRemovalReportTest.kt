package com.zhousl.aether.data

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ExtensionRemovalReportTest {
    private fun reload(scheduled: Boolean = false): JSONObject = JSONObject()
        .put("succeeded", true)
        .put("sessions", JSONArray().put(JSONObject().put("session_id", "chat-1")
            .put("scheduled", scheduled).put("reloaded", !scheduled)))
        .put("aether_reload", JSONObject().put("reloaded", true).put("errors", JSONArray()))

    @Test
    fun activeTurnIsReportedAsScheduledRatherThanUnloaded() {
        val result = extensionRemovalReport("npm:example", reload(scheduled = true))
        assertEquals("scheduled", result.optString("reload_status"))
        assertTrue(result.optBoolean("effective_on_next_turn"))
        assertEquals("chat-1", result.optJSONArray("pending_session_ids")?.optString(0))
        assertTrue(result.optBoolean("removed"))
    }

    @Test
    fun idleReloadIsReportedAsApplied() {
        val result = extensionRemovalReport("npm:example", reload())
        assertEquals("applied", result.optString("reload_status"))
        assertFalse(result.optBoolean("effective_on_next_turn"))
        assertEquals("npm:example", result.optString("source"))
        assertTrue(result.has("reload"))
    }

    @Test
    fun unrelatedBrokenExtensionDiagnosticsAreNotHidden() {
        val response = reload()
        response.getJSONObject("aether_reload").put("errors", JSONArray().put(JSONObject().put("error", "other extension failed")))
        val result = extensionRemovalReport("npm:example", response)
        assertEquals("applied_with_errors", result.optString("reload_status"))
        assertTrue(result.has("reload"))
    }

    @Test(expected = IllegalArgumentException::class)
    fun failedReloadCannotBeReportedAsApplied() {
        extensionRemovalReport("npm:example", JSONObject().put("succeeded", false))
    }
}
