from pathlib import Path

def edit(path, old, new, count=1):
    p = Path(path)
    s = p.read_text()
    if old not in s and new in s:
        return
    assert s.count(old) == count, (path, old[:100], s.count(old))
    p.write_text(s.replace(old, new))

p = 'pi-bridge/src/aether-extensions.ts'
edit(p, 'import { createHash } from "node:crypto";', 'import { createHash } from "node:crypto";\nimport { guardExtensionApi, withExtensionDeadline } from "./extension-operation.js";')
edit(p, '  return {\n    apiVersion: AETHER_API_VERSION,', '  const api: AetherExtensionAPI = {\n    apiVersion: AETHER_API_VERSION,')
edit(p, '  };\n}\n\nasync function loadFactory(', '  };\n  return guardExtensionApi(api);\n}\n\nasync function loadFactory(')
edit(p, '      await extension.cleanup();', '      await withExtensionDeadline("cleanup", extension.id, () => extension.cleanup?.());')
edit(p, '      const factory = await loadFactory(descriptor);', '      const factory = await withExtensionDeadline("load", extension.id, () => loadFactory(descriptor));')
edit(p, '      const cleanup = await factory(createApi(candidate, extension));', '      const cleanup = await withExtensionDeadline("load", extension.id, () => factory(createApi(candidate, extension)));')
edit(p, '      ? await render(createRenderContext(extension))', '      ? await withExtensionDeadline("render", extension.id, () => render(createRenderContext(extension)))')
edit(p, '''      ? await render({
        ...createRenderContext(registration.extension),
        message: { ...message, ...asObject(message.payload) },
      })''', '''      ? await withExtensionDeadline("render", registration.extension.id, () => render({
        ...createRenderContext(registration.extension),
        message: { ...message, ...asObject(message.payload) },
      }))''')
edit(p, '''    const result = await action.handler(
      cloneJson(payload),
      {
        ...createRenderContext(action.extension),
        action: action.localId,
      },
    );''', '''    const result = await withExtensionDeadline("action", action.extension.id, () => action.handler(
      cloneJson(payload),
      {
        ...createRenderContext(action.extension),
        action: action.localId,
      },
    ));''')
edit(p, '''      const rawResult = await registration.handler(
        cloneJson(chainedPayload),
        {
          ...createRenderContext(registration.extension),
          event: eventName,
        },
      );''', '''      const rawResult = await withExtensionDeadline("event", registration.extension.id, () => registration.handler(
        cloneJson(chainedPayload),
        {
          ...createRenderContext(registration.extension),
          event: eventName,
        },
      ));''')
edit('pi-bridge/src/extension-operation.ts', 'if (cached?.source === value) return cached.wrapped;', 'if (cached && cached.source === value) return cached.wrapped;')

p = 'pi-bridge/src/bridge.ts'
s = Path(p).read_text()
if 'import { finishExtensionRemoval }' not in s:
    Path(p).write_text('import { finishExtensionRemoval } from "./extension-removal.js";\n' + s)
edit(p, '''  const removed = await removeAetherExtensionPackage(process.cwd(), source);
  return {
    removed,
    source,
    ...(await installedExtensionPackagesPayload()),
  };''', '''  const removed = await removeAetherExtensionPackage(process.cwd(), source);
  const state = await finishExtensionRemoval(removed, () => reloadAllExtensionSessions(payload));
  return {
    ...state,
    source,
    ...(await installedExtensionPackagesPayload()),
  };''')

p = 'pi-bridge/src/extension-bridge.ts'
s = Path(p).read_text()
if 'import { finishExtensionRemoval }' not in s:
    Path(p).write_text('import { finishExtensionRemoval } from "./extension-removal.js";\n' + s)
edit(p, '''      writeResponse(id, await packageOperation(
        id,
        payload,
        async () => undefined,
        { removed },
      ));''', '''      const state = await finishExtensionRemoval(removed, async () => {
        const result = await packageOperation(id, payload, async () => undefined, { removed });
        return asObject(result.reload);
      });
      writeResponse(id, { ...state, source, ...(await installedPackagesPayload()) });''')

p = 'app/src/main/java/com/zhousl/aether/data/PiExtensionManager.kt'
edit(p, '''    suspend fun remove(extension: InstalledPiExtension): Result<Unit> = withContext(Dispatchers.IO) {
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
                    requireExtensionReloadSucceeded(
                        piKernelBridge.reloadAllExtensions(stateRepository.loadOptions())
                    )
                }

                PiExtensionInstallKind.Imported -> {
                    removeImportedExtension(extension.installedPath)
                    requireExtensionReloadSucceeded(
                        piKernelBridge.reloadAllExtensions(stateRepository.loadOptions())
                    )
                }
            }
            Unit
        }
    }''', '''    suspend fun remove(extension: InstalledPiExtension): Result<Unit> =
        removeWithStatus(extension).mapCatching { response ->
            requireExtensionReloadSucceeded(response.optJSONObject("reload"))
            Unit
        }

    // Keep the structured deletion/reload result for agent callers. The UI wrapper
    // above retains its Result<Unit> contract without issuing a second reload.
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
                    response
                }

                PiExtensionInstallKind.Imported -> {
                    removeImportedExtension(extension.installedPath)
                    val reload = piKernelBridge.reloadAllExtensions(stateRepository.loadOptions())
                    JSONObject().put("removed", true).put("removed_from_disk", true).put("reload", reload)
                }
            }
        }
    }''')

p = 'app/src/main/java/com/zhousl/aether/data/AetherSelfManagementTool.kt'
edit(p, '''                    piExtensionManager.remove(extension).getOrThrow()
                    val payload = piKernelBridge.listExtensionPackages()
                    success(payload) {
                        put("source", source)
                        put("removed", true)
                        put("stdout", "Removed extension package '$source'.")
                    }''', '''                    val payload = piExtensionManager.removeWithStatus(extension).getOrThrow()
                    success(payload) {
                        put("source", source)
                        put("stdout", "Removed extension package '$source'. Runtime reload: ${payload.optString("reload_status")}. Inspect reload details; deferred code remains active until the current turn finishes.")
                    }''')

p = 'pi-bridge/tests/bridge.test.mjs'
edit(p, 'removes extension packages without reloading their code', 'removes extension packages and reports the runtime reload')
edit(p, 'assert.equal(Object.hasOwn(result, "reload"), false);', 'assert.equal(Object.hasOwn(result, "reload"), true);\n    assert.equal(result.removed_from_disk, true);\n    assert.equal(result.reload_status, "applied");')
print('Applied R06/R11 exact edits; no Nightly workflow or signing changes.')
