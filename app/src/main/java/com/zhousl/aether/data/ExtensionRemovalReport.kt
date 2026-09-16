package com.zhousl.aether.data

import org.json.JSONObject

// Current agent-visible removal report, extracted for regression tests.
internal fun extensionRemovalReport(source: String, reload: JSONObject): JSONObject =
    JSONObject().put("source", source).put("removed", true)
