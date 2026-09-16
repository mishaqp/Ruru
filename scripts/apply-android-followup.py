from pathlib import Path
import re

def edit(path, pairs):
    p=Path(path)
    text=p.read_text()
    for old,new in pairs:
        assert text.count(old)==1, (path,old[:100],text.count(old))
        text=text.replace(old,new)
    p.write_text(text)

edit('app/src/main/java/com/zhousl/aether/data/pi/PiKernelBridge.kt', [
('Channel<PiBridgeFrame>(Channel.UNLIMITED)', 'newPiBridgeEventChannel<PiBridgeFrame>()'),
('''        } catch (throwable: Throwable) {
            diagnosticLogger.exception(
                category = "pi_bridge",
                event = "request_failed",''', '''        } catch (throwable: Throwable) {
            if (throwable is PiBridgeException && throwable.code == PiBridgeEventQueueOverflowCode) {
                markRequestCancelled(id)
                eventChannel?.cancel()
                eventJob?.cancel()
                // Do not block stdout or terminate unrelated chats. Abort this
                // request explicitly; overflowing is a failure, never success.
                withContext(NonCancellable) {
                    runCatching {
                        when {
                            abortOnCancellation -> request(
                                type = "abort",
                                payload = JSONObject().put("request_id", id)
                                    .put("session_id", payload.optString("session_id")),
                                timeoutMillis = PiBridgePingTimeoutMillis,
                                abortOnCancellation = false,
                                startIfNeeded = false,
                            )
                            type == "subscribe_aether_extensions" -> request(
                                type = "unsubscribe_aether_extensions",
                                payload = JSONObject().put("request_id", id),
                                timeoutMillis = PiBridgePingTimeoutMillis,
                                abortOnCancellation = false,
                                startIfNeeded = false,
                            )
                        }
                    }
                }
            }
            diagnosticLogger.exception(
                category = "pi_bridge",
                event = "request_failed",'''),
('''        when {
            pending != null && pending.eventChannel != null -> {
                if (pending.eventChannel.trySend(frame).isFailure) {''', '''        when {
            pending != null && pending.response.isCompleted -> Unit
            pending != null && pending.eventChannel != null -> {
                val queueFailure = piBridgeEventQueueFailure(pending.eventChannel.trySend(frame))
                if (queueFailure != null) {'''),
('''                    pending.response.completeExceptionally(
                        PiBridgeException("Pi bridge event queue was closed.", code = "event_queue_closed")
                    )''','''                    pending.response.completeExceptionally(queueFailure)'''),
])

p=Path('app/src/main/java/com/zhousl/aether/data/PiExtensionManager.kt')
s=p.read_text()
a=s.index('    suspend fun remove(extension: InstalledPiExtension): Result<Unit>')
b=s.index('    suspend fun setEnabled(',a)
old=s[a:b]
assert old.count('piKernelBridge.reloadAllExtensions')==2
new='''    suspend fun remove(extension: InstalledPiExtension): Result<Unit> =
        removeWithStatus(extension).map { Unit }

    suspend fun removeWithStatus(extension: InstalledPiExtension): Result<JSONObject> = withContext(Dispatchers.IO) {
        runCatching {
            stateRepository.setEnabled(extension.id, enabled = true)
            when (extension.kind) {
                PiExtensionInstallKind.Package -> {
                    val response = piKernelBridge.removeExtensionPackage(
                        extension.source,
                        stateRepository.loadOptions(),
                    )
                    require(response.optBoolean("removed")) {
                        "No installed Pi extension matched ${extension.source}."
                    }
                }
                PiExtensionInstallKind.Imported -> removeImportedExtension(extension.installedPath)
            }
            // Exactly one reload for both UI and agent callers. Busy sessions
            // are scheduled by Pi and must not be reported as already unloaded.
            val reload = piKernelBridge.reloadAllExtensions(stateRepository.loadOptions())
            requireExtensionReloadSucceeded(reload)
            extensionRemovalReport(extension.source, reload)
        }
    }

'''
p.write_text(s[:a]+new+s[b:])

edit('app/src/main/java/com/zhousl/aether/data/AetherSelfManagementTool.kt', [
('''                    piExtensionManager.remove(extension).getOrThrow()
                    val payload = piKernelBridge.listExtensionPackages()
                    success(payload) {
                        put("source", source)
                        put("removed", true)
                        put("stdout", "Removed extension package '$source'.")
                    }''','''                    val removal = piExtensionManager.removeWithStatus(extension).getOrThrow()
                    val payload = piKernelBridge.listExtensionPackages()
                    removal.keys().forEach { key -> payload.put(key, removal.get(key)) }
                    success(payload) {
                        put("stdout", when (removal.optString("reload_status")) {
                            "scheduled" -> "Removed package '$source'. Its code may remain active until the current turn finishes; verify registration on the next turn."
                            "applied_with_errors" -> "Removed package '$source' and reloaded. Inspect reload diagnostics for other extension errors."
                            else -> "Removed package '$source' and applied the extension reload."
                        })
                    }''')
])

# Remove the unused Nightly build variant as well as its already-deleted workflow.
p=Path('app/build.gradle.kts')
s=p.read_text()
s,n=re.subn(r'^val nightly(?:KeystoreFile|KeystorePassword|KeyAlias|KeyPassword) = .*\n','',s,flags=re.M)
assert n==4, ('nightly signing variables',n)
s,n=re.subn(r'^        create\("nightly"\) \{\n.*?^        \}\n','',s,flags=re.M|re.S)
assert n==2, ('nightly Gradle blocks',n)
p.write_text(s)

# Tighten test name/coverage: exercise a subsequent handler of the same event.
edit('pi-bridge/tests/extension-deadline.test.mjs', [
("a.registerAction('ping', () => ({alive:true}));", "a.registerAction('ping', () => ({alive:true})); a.on('probe',()=>({healthyEvent:true}));"),
("    await healthyResponds(request,first.snapshot);", "    assert.equal(result.payload.healthyEvent,true,'later event handler was not executed');\n    await healthyResponds(request,first.snapshot);"),
])

print('Applied Android queue, removal reporting and build-variant fixes')
