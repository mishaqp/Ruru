package com.zhousl.aether.data.pi

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertSame
import kotlin.test.assertTrue
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

class ExtensionRemovalTest {
    private fun diskResult(removed: Boolean = true) = buildJsonObject { put("removed", removed) }
    private fun reloadResult() = buildJsonObject {
        put("succeeded", true)
        put("sessions", JsonArray(emptyList()))
    }

    @Test
    fun onlySuccessfulDeletionClearsTheDisabledPreferenceBeforeOneReload() = runTest {
        val steps = mutableListOf<String>()
        val result = removeExtensionWithReload(
            "npm:test",
            remove = { steps += "remove"; diskResult() },
            onRemoved = { steps += "clear-disabled" },
            reload = { steps += "reload"; reloadResult() },
        )
        assertEquals(listOf("remove", "clear-disabled", "reload"), steps)
        assertEquals(true, result["ok"]?.jsonPrimitive?.booleanOrNull)
    }

    @Test
    fun missingPackageNeverChangesUserPreference() = runTest {
        val result = removeExtensionWithReload(
            "npm:missing",
            remove = { diskResult(false) },
            onRemoved = { error("Must not clear disabled preference") },
            reload = { error("Must not reload") },
        )
        assertEquals(false, result["ok"]?.jsonPrimitive?.booleanOrNull)
        assertEquals("not_removed", result["reload_status"]?.jsonPrimitive?.content)
    }

    @Test
    fun failedDeletionPropagatesWithoutChangingPreferenceOrReloading() = runTest {
        val failure = IllegalStateException("disk failure")
        val caught = assertFailsWith<IllegalStateException> {
            removeExtensionWithReload(
                "npm:test", remove = { throw failure },
                onRemoved = { error("Must not clear preference") },
                reload = { error("Must not reload") },
            )
        }
        assertSame(failure, caught)
    }

    @Test
    fun cancellationIsNotConvertedIntoACompletedRemoval() = runTest {
        val cancellation = CancellationException("cancel reload")
        val caught = assertFailsWith<CancellationException> {
            removeExtensionWithReload("npm:test", remove = { diskResult() }, reload = { throw cancellation })
        }
        assertSame(cancellation, caught)
    }

    @Test
    fun explicitReloadFailureRetainsDiagnosticsAndDoesNotInventAppliedState() = runTest {
        val diagnostic = buildJsonObject { put("succeeded", false); put("error", "reload rejected") }
        val result = removeExtensionWithReload("npm:test", remove = { diskResult() }, reload = { diagnostic })
        assertEquals(true, result["removed"]?.jsonPrimitive?.booleanOrNull)
        assertEquals(false, result["ok"]?.jsonPrimitive?.booleanOrNull)
        assertEquals(diagnostic, result["reload"])
        assertFalse("effective_on_next_turn" in result)
    }

    @Test
    fun incompleteReloadResponseIsNotTreatedAsCompleted() = runTest {
        val result = removeExtensionWithReload(
            "npm:test", remove = { diskResult() },
            reload = { buildJsonObject { put("succeeded", true) } },
        )
        assertEquals("failed", result["reload_status"]?.jsonPrimitive?.content)
        assertEquals(false, result["ok"]?.jsonPrimitive?.booleanOrNull)
    }

    @Test
    fun preferenceFailureDoesNotHideAlreadyDeletedPackage() = runTest {
        val result = removeExtensionWithReload(
            "npm:test", remove = { diskResult() },
            onRemoved = { error("preference write failure") },
            reload = { error("not reached") },
        )
        assertEquals(true, result["removed"]?.jsonPrimitive?.booleanOrNull)
        assertEquals(false, result["ok"]?.jsonPrimitive?.booleanOrNull)
        assertEquals("clear_removed_preference", result["failed_phase"]?.jsonPrimitive?.content)
        assertTrue(result.toString().contains("preference write failure"))
    }
}
