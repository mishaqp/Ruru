package com.zhousl.aether.data

import org.json.JSONArray
import org.json.JSONObject

/** Reports the actual Android reload result, without claiming immediate hot-unload. */
internal fun extensionRemovalReport(source: String, reload: JSONObject): JSONObject {
    require(reload.opt("succeeded") == true) { "Extension reload did not succeed." }
    val sessions = reload.optJSONArray("sessions") ?: JSONArray()
    val pending = JSONArray()
    var hasErrors = false
    for (index in 0 until sessions.length()) {
        val session = sessions.optJSONObject(index) ?: continue
        if (session.optBoolean("scheduled")) pending.put(session.optString("session_id"))
        if ((session.optJSONArray("errors")?.length() ?: 0) > 0) hasErrors = true
    }
    val aetherReload = reload.optJSONObject("aether_reload")
    if ((aetherReload?.optJSONArray("errors")?.length() ?: 0) > 0) hasErrors = true
    val scheduled = pending.length() > 0
    return JSONObject()
        .put("source", source)
        .put("removed", true)
        .put("reload_status", when {
            scheduled -> "scheduled"
            hasErrors -> "applied_with_errors"
            else -> "applied"
        })
        .put("effective_on_next_turn", scheduled)
        .put("pending_session_ids", pending)
        .put("reload_has_errors", hasErrors)
        .put("reload", JSONObject(reload.toString()))
}
