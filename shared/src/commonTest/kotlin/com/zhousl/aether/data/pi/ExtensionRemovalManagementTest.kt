package com.zhousl.aether.data.pi

import com.zhousl.aether.data.AppSettings
import com.zhousl.aether.data.SharedAetherExtensionSnapshot
import com.zhousl.aether.data.SharedSkillManager
import com.zhousl.aether.runtime.MultiplatformLocalRuntime
import com.zhousl.aether.runtime.PiBridgeTransport
import com.zhousl.aether.runtime.RuntimeFileSystem
import com.zhousl.aether.runtime.RuntimeProcess
import com.zhousl.aether.runtime.RuntimeProcessExit
import com.zhousl.aether.runtime.RuntimeProcessSignal
import com.zhousl.aether.runtime.RuntimeProcessSpec
import com.zhousl.aether.runtime.RuntimeSetupProgress
import com.zhousl.aether.runtime.SharedPiBridgeClient
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

class ExtensionRemovalManagementTest {
    @Test
    fun busyRemovalReloadsOnceAndReportsDeferredApplication() = runTest {
        removalFixture(scheduled = true) { result, requests ->
            assertEquals(listOf("remove_extension_package", "reload_all_extensions"), requests)
            assertFalse(result.isError)
            val payload = Json.parseToJsonElement(result.outputJson).jsonObject
            assertEquals(true, payload["removed"]?.jsonPrimitive?.booleanOrNull)
            assertEquals("scheduled", payload["reload_status"]?.jsonPrimitive?.content)
            assertEquals(true, payload["effective_on_next_turn"]?.jsonPrimitive?.booleanOrNull)
            assertEquals(true, payload["reload"]?.jsonObject?.get("succeeded")?.jsonPrimitive?.booleanOrNull)
        }
    }

    @Test
    fun idleRemovalReportsCompletedApplication() = runTest {
        removalFixture { result, requests ->
            assertEquals(listOf("remove_extension_package", "reload_all_extensions"), requests)
            assertFalse(result.isError)
            val payload = Json.parseToJsonElement(result.outputJson).jsonObject
            assertEquals("completed", payload["reload_status"]?.jsonPrimitive?.content)
            assertEquals(false, payload["effective_on_next_turn"]?.jsonPrimitive?.booleanOrNull)
        }
    }

    @Test
    fun missingPackageIsNotReportedAsSuccessfulAndDoesNotReload() = runTest {
        removalFixture(removed = false) { result, requests ->
            assertTrue(result.isError)
            assertEquals(listOf("remove_extension_package"), requests)
        }
    }

    @Test
    fun failedReloadPreservesTheSuccessfulDiskRemovalFact() = runTest {
        removalFixture(failReload = true) { result, requests ->
            assertTrue(result.isError)
            assertEquals(listOf("remove_extension_package", "reload_all_extensions"), requests)
            val payload = Json.parseToJsonElement(result.outputJson).jsonObject
            assertEquals(true, payload["removed"]?.jsonPrimitive?.booleanOrNull)
            assertEquals("failed", payload["reload_status"]?.jsonPrimitive?.content)
            assertTrue(payload.toString().contains("test reload failure"))
        }
    }

    private suspend fun TestScope.removalFixture(
        scheduled: Boolean = false,
        removed: Boolean = true,
        failReload: Boolean = false,
        check: suspend (SharedHostToolResult, List<String>) -> Unit,
    ) {
        val transport = RemovalTransport(scheduled, removed, failReload)
        val bridge = SharedPiBridgeClient(transport, StandardTestDispatcher(testScheduler))
        val runtime = RemovalRuntime()
        val tools = SharedAgentManagementTools(
            runtime = runtime,
            bridge = bridge,
            skillManager = SharedSkillManager(runtime),
            settings = { AppSettings() },
            updateSettings = {},
            currentSessionId = { "removal-test-session" },
            extensionSettings = { SharedAetherExtensionSnapshot() },
            updateExtensionSetting = { _, _, _, _ -> SharedAetherExtensionSnapshot() },
        )
        try {
            val result = tools.execute("aether_extension_manage", buildJsonObject {
                put("action", "remove_package")
                put("source", "npm:removal-fixture")
            })
            check(result, transport.requests)
        } finally {
            bridge.close()
        }
    }
}

private class RemovalTransport(
    private val scheduled: Boolean,
    private val removed: Boolean,
    private val failReload: Boolean,
) : PiBridgeTransport, RuntimeProcess {
    val requests = mutableListOf<String>()
    private val output = Channel<ByteArray>(Channel.UNLIMITED)
    private val exit = CompletableDeferred<RuntimeProcessExit>()
    override val pid = 701
    override val stdout = output.receiveAsFlow()
    override val stderr = emptyFlow<ByteArray>()
    override suspend fun start(): RuntimeProcess = this
    override suspend fun stop() { output.close(); exit.complete(RuntimeProcessExit(0)) }
    override suspend fun writeStdin(bytes: ByteArray) {
        val request = Json.parseToJsonElement(bytes.decodeToString().trim()).jsonObject
        val type = request.getValue("type").jsonPrimitive.content
        requests += type
        val failed = type == "reload_all_extensions" && failReload
        val payload = when (type) {
            "remove_extension_package" -> buildJsonObject {
                put("removed", removed)
                put("source", "npm:removal-fixture")
                put("packages", JsonArray(emptyList()))
            }
            "reload_all_extensions" -> buildJsonObject {
                put("succeeded", true)
                put("sessions", JsonArray(listOf(buildJsonObject {
                    put("session_id", "removal-test-session")
                    put("scheduled", scheduled)
                    put("reloaded", !scheduled)
                })))
            }
            else -> error("Unexpected management request: $type")
        }
        val frame = buildJsonObject {
            put("id", request.getValue("id"))
            put("type", if (failed) "error" else "response")
            put("ok", !failed)
            if (failed) put("error", buildJsonObject {
                put("message", "test reload failure")
                put("code", "test_reload_failure")
            }) else put("payload", payload)
        }
        output.send((frame.toString() + "\n").encodeToByteArray())
    }
    override suspend fun closeStdin() = stop()
    override suspend fun awaitExit(): RuntimeProcessExit = exit.await()
    override suspend fun signal(signal: RuntimeProcessSignal) = stop()
}

private class RemovalRuntime : MultiplatformLocalRuntime {
    override val homeDirectory = "/root"
    override val workspaceRoot = "/workspace"
    override val fileSystem = object : RuntimeFileSystem {
        override suspend fun exists(path: String) = false
        override suspend fun createDirectories(path: String) = Unit
        override suspend fun read(path: String): ByteArray = error("Unexpected read")
        override suspend fun write(path: String, content: ByteArray, executable: Boolean) = Unit
        override suspend fun remove(path: String, recursive: Boolean) = Unit
        override suspend fun bindHostDirectory(hostPath: String, guestPath: String, readOnly: Boolean) = Unit
    }
    override suspend fun initialize(onProgress: (RuntimeSetupProgress) -> Unit) = Unit
    override suspend fun startProcess(spec: RuntimeProcessSpec): RuntimeProcess = error("Unexpected process")
}
