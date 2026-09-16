from pathlib import Path

p = Path('pi-bridge/src/aether-extensions.ts')
s = p.read_text()
def replace(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:100], s.count(old), count)
    s = s.replace(old, new)
replace('import { createHash } from "node:crypto";', 'import { createHash } from "node:crypto";\nimport { ExtensionExecution, guardExtensionApi } from "./extension-execution.js";')
replace('interface LoadedAetherExtension extends AetherExtensionDescriptor {\n  cleanup?', 'interface LoadedAetherExtension extends AetherExtensionDescriptor {\n  execution: ExtensionExecution;\n  cleanup?')
replace('    ...cloneJson(latestHostContext),\n    extension:', '    ...cloneJson(latestHostContext),\n    signal: extension.execution.signal,\n    extension:')
replace('if (runtime === runtimeState) bumpVersion();', 'if (runtime === runtimeState && extension.execution.active) bumpVersion();')
replace('  return {\n    apiVersion: AETHER_API_VERSION,', '  const api: AetherExtensionAPI = {\n    apiVersion: AETHER_API_VERSION,\n    signal: extension.execution.signal,')
replace('  };\n}\n\nasync function loadFactory(', '  };\n  return guardExtensionApi(api, extension.execution);\n}\n\nasync function loadFactory(')
replace('    if (preservedExtensions.has(extension)) continue;\n    if (!extension.cleanup) continue;', '    if (preservedExtensions.has(extension)) continue;\n    extension.execution.revoke();\n    if (!extension.cleanup) continue;')
replace('      await extension.cleanup();', '      await extension.execution.run("cleanup", () => extension.cleanup?.());')
replace('    const extension: LoadedAetherExtension = { ...descriptor };', '    const extension: LoadedAetherExtension = { ...descriptor, execution: new ExtensionExecution(descriptor.id) };')
replace('      const factory = await loadFactory(descriptor);\n      if (!factory) continue;\n      const cleanup = await factory(createApi(candidate, extension));', '      const factory = await extension.execution.run("load", () => loadFactory(descriptor));\n      if (!factory) {\n        extension.execution.revoke();\n        continue;\n      }\n      const cleanup = await extension.execution.run("load", () => factory(createApi(candidate, extension)));')
replace('    } catch (error) {\n      removeExtensionRegistrations(candidate, extension);', '    } catch (error) {\n      extension.execution.revoke();\n      removeExtensionRegistrations(candidate, extension);')
replace('? await render(createRenderContext(extension))', '? await extension.execution.run("render", () => render(createRenderContext(extension)))')
replace('      ? await render({\n        ...createRenderContext(registration.extension),\n        message: { ...message, ...asObject(message.payload) },\n      })', '      ? await registration.extension.execution.run("render", () => render({\n        ...createRenderContext(registration.extension),\n        message: { ...message, ...asObject(message.payload) },\n      }))')
replace('    const result = await action.handler(\n', '    const result = await action.extension.execution.run("action", () => action.handler(\n')
replace('        action: action.localId,\n      },\n    );', '        action: action.localId,\n      },\n    ));')
replace('      const rawResult = await registration.handler(\n', '      const rawResult = await registration.extension.execution.run("event", () => registration.handler(\n')
replace('          event: eventName,\n        },\n      );', '          event: eventName,\n        },\n      ));')
p.write_text(s)
p=Path('packages/extension-api/src/index.ts')
s=p.read_text()
assert s.count('export type AetherRenderContext = AetherJsonObject & {') == 1
s=s.replace('export type AetherRenderContext = AetherJsonObject & {', 'export type AetherRenderContext = AetherJsonObject & {\n  /** Cooperative cancellation when this extension instance is revoked. */\n  signal?: AbortSignal;')
assert s.count('  readonly apiVersion: 2;') == 1
s=s.replace('  readonly apiVersion: 2;', '  readonly apiVersion: 2;\n  /** Aborted on callback timeout or instance disposal. Optional for older hosts. */\n  readonly signal?: AbortSignal;')
p.write_text(s)
print('Applied owner-aware extension deadlines and SDK revocation')
