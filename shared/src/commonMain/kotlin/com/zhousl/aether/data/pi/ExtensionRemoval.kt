package com.zhousl.aether.data.pi

import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * High-level removal for UI/agent management. The bridge's disk-only operation
 * stays unchanged because archive restore deliberately batches removals.
 * A successful reload can be scheduled, not completed, while a turn is busy.
 */
suspend fun removeExtensionWithReload(
    source: String,
    remove: suspend () -> JsonObject,
    reload: suspend () -> JsonObject,
    onRemoved: suspend () -> Unit = {},
): JsonObject {
    val removed = remove()
    if (removed.flag("removed") != true) {
        return buildJsonObject {
            removed.forEach { (key, value) -> put(key, value) }
            put("source", source)
            put("ok", false)
            put("removed", false)
            put("reload_status", "not_removed")
            put("errmsg", "No installed extension package matched '$source'.")
        }
    }

    var phase = "clear_removed_preference"
    try {
        // Do not re-enable an extension whose deletion failed.
        onRemoved()
        phase = "reload"
        val reloaded = reload()
        val sessions = reloaded["sessions"] as? JsonArray
        val validSessions = sessions != null && sessions.all { item ->
            val session = item as? JsonObject
            session != null && (session.flag("scheduled") == true || session.flag("reloaded") == true)
        }
        val succeeded = reloaded.flag("succeeded") == true && validSessions
        val scheduled = sessions.orEmpty().any { (it as? JsonObject)?.flag("scheduled") == true }
        return buildJsonObject {
            removed.forEach { (key, value) -> put(key, value) }
            put("source", source)
            put("ok", succeeded)
            put("removed", true)
            put("reload", reloaded)
            put("reload_status", when {
                !succeeded -> "failed"
                scheduled -> "scheduled"
                else -> "completed"
            })
            if (succeeded) put("effective_on_next_turn", scheduled)
            if (!succeeded) put("errmsg", "Package was removed, but runtime reload did not confirm success. Inspect reload diagnostics.")
            put("stdout", when {
                !succeeded -> "Removed extension package '$source' from disk; runtime reload failed or returned an incomplete response."
                scheduled -> "Removed extension package '$source' from disk. Runtime reload is scheduled after active turns finish; current work may still use the old code."
                else -> "Removed extension package '$source'. Session reload completed; inspect the included Aether diagnostics for UI extension errors."
            })
        }
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (failure: Throwable) {
        // File removal cannot be rolled back by hiding it behind a reload error.
        return buildJsonObject {
            removed.forEach { (key, value) -> put(key, value) }
            put("source", source)
            put("ok", false)
            put("removed", true)
            put("reload_status", "failed")
            put("failed_phase", phase)
            put("errmsg", failure.message ?: "Failed to apply extension removal.")
            put("stdout", "Removed extension package '$source' from disk, but applying the change failed. Reload extensions before assuming the old code is inactive.")
        }
    }
}

private fun JsonObject.flag(name: String): Boolean? = (get(name) as? JsonPrimitive)?.booleanOrNull
