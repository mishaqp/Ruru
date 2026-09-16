"""Temporary exact-source patch, executed only on the dedicated GitHub branch."""
from pathlib import Path


def replace_once(source, old, new, file):
    if new in source:
        return source
    assert source.count(old) == 1, (file, old[:100], source.count(old))
    return source.replace(old, new, 1)


p = Path('shared/src/commonMain/kotlin/com/zhousl/aether/data/pi/SharedAgentManagementTools.kt')
s = p.read_text()
s = replace_once(s, '''                bridge.removeExtensionPackage(source)
''', '''                val removal = removeExtensionWithReload(
                    source = source,
                    remove = { bridge.removeExtensionPackage(source) },
                    reload = { bridge.reloadAllExtensions() },
                )
                return SharedHostToolResult(
                    outputJson = removal.toString(),
                    isError = removal["ok"]?.jsonPrimitive?.booleanOrNull != true,
                )
''', str(p))
p.write_text(s)

p = Path('app/src/main/java/com/zhousl/aether/data/PiExtensionManager.kt')
s = p.read_text()
if 'suspend fun removeWithStatus(' not in s:
    start = s.index('    suspend fun remove(extension: InstalledPiExtension): Result<Unit>')
    end = s.index('    suspend fun setEnabled(', start)
    assert 'stateRepository.setEnabled(extension.id, enabled = true)' in s[start:end]
    s = s[:start] + '''    suspend fun remove(extension: InstalledPiExtension): Result<Unit> =
        removeWithStatus(extension).mapCatching { response ->
            require(response.optBoolean("ok")) {
                response.optString("errmsg").ifBlank { "Extension removal could not be applied." }
            }
            Unit
        }

    /** Detailed management result; UI callers retain the Result<Unit> wrapper. */
    suspend fun removeWithStatus(extension: InstalledPiExtension): Result<JSONObject> = withContext(Dispatchers.IO) {
        runCatching {
            val response = removeExtensionWithReload(
                source = extension.source.ifBlank { extension.id },
                remove = {
                    val removed = when (extension.kind) {
                        PiExtensionInstallKind.Package -> piKernelBridge.removeExtensionPackage(
                            extension.source,
                            stateRepository.loadOptions(),
                        )
                        PiExtensionInstallKind.Imported -> {
                            removeImportedExtension(extension.installedPath)
                            JSONObject().put("removed", true)
                        }
                    }
                    Json.parseToJsonElement(removed.toString()).jsonObject
                },
                onRemoved = { stateRepository.setEnabled(extension.id, enabled = true) },
                reload = {
                    Json.parseToJsonElement(
                        piKernelBridge.reloadAllExtensions(stateRepository.loadOptions()).toString(),
                    ).jsonObject
                },
            )
            JSONObject(response.toString())
        }.onFailure { failure ->
            if (failure is CancellationException) throw failure
        }
    }

''' + s[end:]
    imports = [
        'com.zhousl.aether.data.pi.removeExtensionWithReload',
        'kotlinx.coroutines.CancellationException',
        'kotlinx.serialization.json.Json',
        'kotlinx.serialization.json.jsonObject',
    ]
    for name in imports:
        if f'import {name}\n' not in s:
            s = s.replace('package com.zhousl.aether.data\n', f'package com.zhousl.aether.data\n\nimport {name}\n', 1)
p.write_text(s)

p = Path('app/src/main/java/com/zhousl/aether/data/AetherSelfManagementTool.kt')
s = p.read_text()
s = replace_once(s, '''                    piExtensionManager.remove(extension).getOrThrow()
                    val payload = piKernelBridge.listExtensionPackages()
                    success(payload) {
                        put("source", source)
                        put("removed", true)
                        put("stdout", "Removed extension package '$source'.")
                    }
''', '''                    // Preserve removed=true even if the subsequent reload fails,
                    // and expose scheduled application instead of claiming hot-unload.
                    piExtensionManager.removeWithStatus(extension).getOrThrow().toString()
''', str(p))
s = replace_once(s, '''        }.getOrElse { throwable ->
            failure(throwable.message ?: "Pi extension operation failed.")
''', '''        }.getOrElse { throwable ->
            if (throwable is kotlinx.coroutines.CancellationException) throw throwable
            failure(throwable.message ?: "Pi extension operation failed.")
''', str(p))
p.write_text(s)
print('Patched Android and shared high-level removal; disk-only bridge/archive contract unchanged.')
