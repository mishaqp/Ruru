#!/usr/bin/env python3
"""One-shot, fail-closed repair applied only by the temporary feature-branch workflow."""
from pathlib import Path
import json


def replace_once(filename: str, old: str, new: str) -> None:
    path = Path(filename)
    text = path.read_text()
    if old not in text and new in text:
        return
    assert text.count(old) == 1, f"Unexpected source in {filename}: {text.count(old)} matches"
    path.write_text(text.replace(old, new, 1))


replace_once("pi-bridge/src/aether-ui-i18n.ts", '''function localizeValue(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((entry) => localizeValue(entry));
  if (value && typeof value === "object") {
    const result: JsonRecord = {};
    for (const [childKey, childValue] of Object.entries(value as JsonRecord)) {
      result[childKey] = localizeValue(childValue, childKey);
    }
    return result;
  }
  if (typeof value === "string" && PRESENTATION_KEYS.has(key)) {
    return translateText(value);
  }
  return value;
}''', '''// Only descend through declarative UI containers. Arbitrary extension data
// (args, payload, storage, values, schemas, prompts, etc.) is opaque, even when
// it happens to contain keys such as text, label or description.
const PRESENTATION_CONTAINERS = new Set([
  "surfaces", "components", "tree", "children", "settings", "sections",
  "categories", "options", "actions", "details", "items", "composer_menu_items",
  "message_types", "tool_titles", "custom_messages", "errors",
]);

function localizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => localizeValue(entry));
  if (!value || typeof value !== "object") return value;
  const object = value as JsonRecord;
  const literalContent = object.type === "code" || object.type === "web" || object.type === "html";
  const result: JsonRecord = {};
  for (const [key, child] of Object.entries(object)) {
    if (typeof child === "string" && PRESENTATION_KEYS.has(key) && !(literalContent && key === "text")) {
      result[key] = translateText(child);
    } else if (PRESENTATION_CONTAINERS.has(key)) {
      result[key] = localizeValue(child);
    } else {
      result[key] = child;
    }
  }
  return result;
}''')

replace_once("pi-bridge/src/extension-dependencies.ts",
    "function dependencyFingerprint(manifest: Record<string, unknown>): string {",
    "function dependencyFingerprint(manifest: Record<string, unknown>, packageRoot: string): string {")
replace_once("pi-bridge/src/extension-dependencies.ts", '''  return createHash("sha256")
    .update(JSON.stringify(dependencies))
    .digest("hex");''', '''  const lockfile = path.join(packageRoot, "package-lock.json");
  return createHash("sha256")
    .update(JSON.stringify({
      dependencies,
      lockfile: fs.existsSync(lockfile) ? fs.readFileSync(lockfile, "utf8") : null,
      platform: process.platform,
      arch: process.arch,
      nodeMajor: process.versions.node.split(".")[0],
    }))
    .digest("hex");''')
replace_once("pi-bridge/src/extension-dependencies.ts",
    "const fingerprint = dependencyFingerprint(manifest);",
    "const fingerprint = dependencyFingerprint(manifest, resolvedRoot);")

runner = Path("extensions/pi-subagents/src/agent-runner.ts")
source = runner.read_text()
if "const cleanupStartupAbort = forwardAbortSignal" not in source:
    old = '''  const onAbort = () => session.abort();
  signal.addEventListener("abort", onAbort, { once: true });'''
    new = '''  const onAbort = () => { void session.abort().catch(() => {}); };
  if (signal.aborted) {
    onAbort();
    return () => {};
  }
  signal.addEventListener("abort", onAbort, { once: true });'''
    assert source.count(old) == 1
    source = source.replace(old, new)
    start = source.index("export async function runAgent(")
    stop = source.index("\n/**\n * Send a new prompt to an existing session", start)
    block = source[start:stop]
    def change(old, new):
        global block
        assert block.count(old) == 1, f"Runner anchor count {block.count(old)}: {old[:80]}"
        block = block.replace(old, new)
    change("  const config = getConfig(type);", "  options.signal?.throwIfAborted();\n  const config = getConfig(type);")
    change("  const env = await detectEnv(options.pi, effectiveCwd);", "  const env = await detectEnv(options.pi, effectiveCwd);\n  options.signal?.throwIfAborted();")
    change("  await runInChildSessionContext(() => loader.reload());", "  await runInChildSessionContext(() => loader.reload());\n  options.signal?.throwIfAborted();")
    change("  options.onSessionCreated?.(session);", "  options.signal?.throwIfAborted();\n  options.onSessionCreated?.(session);")
    change("  const cleanupAbort = forwardAbortSignal(session, options.signal);\n", "")
    change("    cleanupAbort();\n", "")
    change("    await session.prompt(effectivePrompt);", "    options.signal?.throwIfAborted();\n    await session.prompt(effectivePrompt);")
    anchor = "  const { session } = await runInChildSessionContext(() => createAgentSession(sessionOpts));\n"
    assert block.count(anchor) == 1
    before, after = block.split(anchor)
    assert after.endswith("}\n")
    body = after[:-2].strip("\n")
    # The startup listener spans bindExtensions as well as prompt. Only a
    # successful run transfers session ownership to the manager for resume.
    block = before + anchor + '''  const cleanupStartupAbort = forwardAbortSignal(session, options.signal);
  try {
    options.signal?.throwIfAborted();
''' + "\n".join("  " + line if line else line for line in body.splitlines()) + '''
  } catch (error) {
    try { await session.abort(); } catch { /* preserve the original failure */ }
    try { session.dispose(); } catch { /* preserve the original failure */ }
    throw error;
  } finally {
    cleanupStartupAbort();
  }
}
'''
    source = source[:start] + block + source[stop:]
    source = source.replace('''  const startLen = session.messages.length;
  const collector = collectResponseText(session);''', '''  options.signal?.throwIfAborted();
  const startLen = session.messages.length;
  const collector = collectResponseText(session);''', 1)
    source = source.replace('''  try {
    await session.prompt(prompt);''', '''  try {
    options.signal?.throwIfAborted();
    await session.prompt(prompt);''', 1)
    runner.write_text(source)

replace_once("extensions/pi-subagents/src/agent-manager.ts",
    '      options.signal.addEventListener("abort", onParentAbort, { once: true });',
    '      if (options.signal.aborted) onParentAbort();\n      else options.signal.addEventListener("abort", onParentAbort, { once: true });')
replace_once("extensions/pi-subagents/src/agent-manager.ts",
    '      parentSignal.addEventListener("abort", onParentAbort, { once: true });',
    '      if (parentSignal.aborted) onParentAbort();\n      else parentSignal.addEventListener("abort", onParentAbort, { once: true });')

manifest = json.loads(Path("pi-bridge/package.json").read_text())
for constant, dependency in [("PiAiVersion", "pi-ai"), ("PiAgentCoreVersion", "pi-agent-core"), ("PiCodingAgentVersion", "pi-coding-agent")]:
    version = manifest["dependencies"][f"@earendil-works/{dependency}"]
    replace_once("app/src/main/java/com/zhousl/aether/data/pi/PiKernelBridge.kt",
        f'private const val {constant} = "0.84.1"', f'private const val {constant} = "{version}"')
print("Applied R01, R02, R12 and R13 repairs; no branch/release/nightly operations performed by this script.")
