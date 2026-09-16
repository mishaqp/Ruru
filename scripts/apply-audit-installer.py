#!/usr/bin/env python3
"""Feature-branch integration only; removed before merge."""
from pathlib import Path
import hashlib
import subprocess

BASE = "a063adeb187f98073d3573242a43679ae7f6277c"


def replace_once(filename, old, new):
    path = Path(filename)
    source = path.read_text()
    if old not in source and new in source:
        return
    assert source.count(old) == 1, f"Unexpected source in {filename}: {source.count(old)}"
    path.write_text(source.replace(old, new, 1))


runtime = Path("app/src/main/java/com/zhousl/aether/runtime/AlpineRuntime.kt")
source = runtime.read_text()
if "private fun installBundledExtensions()" not in source:
    old_call = 'installAssetDirectoryRecursively("extensions", "/root/.aether/extensions")'
    assert source.count(old_call) == 2
    source = source.replace(old_call, "installBundledExtensions()")
    start = source.index("    private fun installAssetDirectoryRecursively(")
    end = source.index("\n    internal fun markPreinstalledExtensionRemoved", start)
    source = source[:start] + '''    private fun installBundledExtensions() {
        val targetRoot = guestPathToHostFile("/root/.aether/extensions")
        val stateRoot = guestPathToHostFile("/root/.aether/.ruru-bundle-install")
        val installer = BundledExtensionInstaller(targetRoot, stateRoot)
        for (name in appContext.assets.list("extensions").orEmpty().sorted()) {
            if (guestPathToHostFile("/root/.aether/.removed-preinstalled-extensions/$name").existsNoFollow()) continue
            val baseline = runCatching {
                val properties = java.util.Properties()
                appContext.assets.open("ruru-extension-baselines/$name.properties").reader().use { properties.load(it) }
                properties.stringPropertyNames().associateWith { properties.getProperty(it) }
            }.getOrDefault(emptyMap())
            val result = installer.install(name, baseline) { stage ->
                copyBundledAssetDirectory("extensions/$name", stage)
            }
            diagnosticLogger.event(
                category = "extensions",
                event = "bundled_extension_sync",
                level = if (result == BundleInstallResult.PreservedLocalChanges) "warn" else "info",
                details = mapOf("extension" to name, "result" to result.name),
            )
        }
    }

    private fun copyBundledAssetDirectory(assetPath: String, output: File) {
        check(output.mkdirs() || output.isDirectory) { "Unable to create bundled extension staging directory." }
        for (name in appContext.assets.list(assetPath).orEmpty()) {
            require(name != "." && name != ".." && '/' !in name && '\\\\' !in name) { "Invalid bundled asset name." }
            val childPath = "$assetPath/$name"
            val child = File(output, name)
            if (appContext.assets.list(childPath).orEmpty().isNotEmpty()) {
                copyBundledAssetDirectory(childPath, child)
            } else {
                appContext.assets.open(childPath).use { input ->
                    child.outputStream().use { destination -> input.copyTo(destination) }
                }
            }
        }
    }
''' + source[end:]
    runtime.write_text(source)

# A legacy installation had no ownership marker. Recognize only exact sources
# from the audited, previously released commit; never guess that edited files
# or an arbitrary imported package belong to the app.
output = Path("app/src/main/assets/ruru-extension-baselines")
output.mkdir(parents=True, exist_ok=True)
for name in ("pi-mcp-adapter", "pi-subagents", "pi-web-access"):
    prefix = f"extensions/{name}/"
    paths = subprocess.check_output(["git", "ls-tree", "-rz", "--name-only", BASE, "--", prefix]).decode().split("\0")
    lines = [f"# Exact bundled source baseline from {BASE}"]
    for filename in sorted(filter(None, paths)):
        relative = filename.removeprefix(prefix)
        assert not any(c in relative for c in "\n\r\t"), "Unsupported baseline path"
        data = subprocess.check_output(["git", "show", f"{BASE}:{filename}"])
        key = "".join("\\" + c if c in "\\ :=#!" else c for c in relative)
        lines.append(f"{key}={hashlib.sha256(data).hexdigest()}")
    assert len(lines) > 2
    (output / f"{name}.properties").write_text("\n".join(lines) + "\n")

replace_once("pi-bridge/src/aether-extensions.ts",
    "  if (candidate.errors.length > 0 && successfulLoads === 0) {",
    '''  // Restoring the whole previous runtime is valid only when every old
  // extension is still permitted and retained. A newly disabled/removed
  // extension must not be resurrected because a different package failed.
  if (candidate.errors.length > 0 && successfulLoads === 0 &&
      previous.extensions.every((extension) => preservedExtensions.has(extension))) {''')

smoke = "pi-bridge/tests/bundled-runtime.test.mjs"
replace_once(smoke, "// Uses the real bundled packages, but a local faux model: no model API credentials.", '''// Assert user-visible presentation separately from opaque runtime metadata.
// In particular Web Access's internal bindings must NOT be translated.
const opaqueSnapshotKeys = new Set([
  "bindings", "args", "editArgs", "deleteArgs", "trailingArgs", "trailing_args",
  "payload", "data", "storage", "value", "default", "schema", "parameters",
]);
const presentationJson = snapshot => JSON.stringify(snapshot, (key, value) =>
  opaqueSnapshotKeys.has(key) ? undefined : value
);

// Uses the real bundled packages, but a local faux model: no model API credentials.''')
replace_once(smoke, "const ruSnapshot = JSON.stringify(ui.snapshot);", "const ruSnapshot = presentationJson(ui.snapshot);")
replace_once(smoke, "const enSnapshot = JSON.stringify(enUi.snapshot);", '''const enSnapshot = presentationJson(enUi.snapshot);
    const providerBindings = snapshot => snapshot.settings
      .find(page => page.local_id === "web-access-settings")?.categories
      .find(category => category.id === "provider")?.sections
      .find(section => section.id === "provider")?.bindings;
    assert.ok(providerBindings(ui.snapshot), "real Web Access bindings must be present");
    assert.deepEqual(providerBindings(ui.snapshot), providerBindings(enUi.snapshot), "RU must not mutate runtime bindings");''')
print("Integrated bundled-source migration, R07 rollback fix, and opaque-data smoke assertions.")
