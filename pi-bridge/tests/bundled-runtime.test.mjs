import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { test } from "node:test";

// Uses the real bundled packages, but a local faux model: no model API credentials.
// An isolated bridge copy prevents accidental resolution from the CI checkout's node_modules.
test("bundled integrations load in a clean native runtime, expose UI, and respect disabling", { timeout: 600_000 }, async () => {
  const home = await mkdtemp(join(tmpdir(), "ruru-bundled-runtime-"));
  const workspace = join(home, "workspace");
  const root = join(home, ".aether", "extensions");
  await mkdir(workspace, { recursive: true });
  await mkdir(root, { recursive: true });
  const names = ["pi-mcp-adapter", "pi-subagents", "pi-web-access"];
  for (const name of names) {
    await cp(resolve("../extensions", name), join(root, name), { recursive: true });
  }
  const bridge = join(home, "bridge.mjs");
  await cp(resolve("dist/bridge.mjs"), bridge);
  const child = spawn(process.execPath, [bridge], {
    cwd: workspace,
    env: { ...process.env, HOME: home, USERPROFILE: home, PI_CODING_AGENT_DIR: join(home, ".pi", "agent") },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  const pending = new Map();
  let nextId = 0;
  child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-20_000); });
  const lines = createInterface({ input: child.stdout });
  lines.on("line", line => {
    if (!line.trim()) return;
    let frame;
    try { frame = JSON.parse(line); } catch { return; }
    if (frame.type === "event") return;
    const waiter = pending.get(frame.id);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    pending.delete(frame.id);
    if (frame.type === "error" || frame.ok === false) waiter.reject(new Error(JSON.stringify(frame.error)));
    else waiter.resolve(frame.payload);
  });
  const request = (type, payload = {}) => new Promise((resolve, reject) => {
    const id = `bundled-${++nextId}`;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${type} timed out: ${stderr}`)); }, 420_000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ id, type, payload })}\n`);
  });
  const turn = {
    session_id: "bundled-smoke",
    platform: "android",
    runtime: "alpine",
    workspace_directory: workspace,
    model_config: { provider_type: "faux", provider_config_id: "faux", pi_provider_id: "faux", pi_api: "faux", model_id: "faux-1", base_url: "http://localhost:0", reasoning: false, faux_response: "done" },
    system_prompt: "Return done. Do not call tools.",
    messages: [{ role: "user", content: [{ type: "text", text: "smoke test" }] }],
    host_tools: [], reasoning: "off",
  };
  try {
    // Do NOT preload the UI. This exercises the native session's dependency installer.
    await request("run_turn", turn);
    const inventory = await request("list_extensions", { session_id: turn.session_id });
    assert.deepEqual(inventory.errors, [], JSON.stringify(inventory.errors));
    for (const name of names) {
      assert.ok(inventory.extension_paths.some(p => p.startsWith(join(root, name) + "/")), `${name} not registered: ${JSON.stringify(inventory)}`);
    }
    assert.ok(inventory.tools.length > 3);

    // This initial snapshot covers visible Auto-provider UI. Provider-specific
    // descriptions use the same presentation localizer when their category opens.
    const ui = await request("reload_aether_extensions", { context: { platform: "android", language: "ru" } });
    assert.equal(ui.reloaded, true, JSON.stringify(ui));
    assert.deepEqual(ui.snapshot.errors, [], JSON.stringify(ui.snapshot.errors));
    assert.ok(ui.snapshot.settings.length >= 3);
    const ruSnapshot = JSON.stringify(ui.snapshot);
    assert.match(ruSnapshot, /Веб-доступ/);
    assert.match(ruSnapshot, /Все доступные провайдеры/);
    assert.match(ruSnapshot, /MCP-серверы/);
    assert.match(ruSnapshot, /Субагенты/);
    assert.match(ruSnapshot, /Добавить MCP-сервер/);
    assert.match(ruSnapshot, /Типы субагентов/);
    assert.match(ruSnapshot, /Создать описание агента/);
    assert.match(ruSnapshot, /Извлечение контекста/);
    assert.match(ruSnapshot, /Конфиденциальность и сеть/);
    assert.match(ruSnapshot, /Исходные результаты/);
    assert.doesNotMatch(ruSnapshot, /"Web Access"/);
    assert.doesNotMatch(ruSnapshot, /"All eligible providers"/);
    assert.doesNotMatch(ruSnapshot, /"MCP Servers"/);
    assert.doesNotMatch(ruSnapshot, /"Add MCP server"/);
    assert.doesNotMatch(ruSnapshot, /"Subagent Types"/);
    assert.doesNotMatch(ruSnapshot, /"Create agent definition"/);
    assert.doesNotMatch(ruSnapshot, /"Context Extraction"/);
    assert.doesNotMatch(ruSnapshot, /"Privacy and network"/);
    assert.doesNotMatch(ruSnapshot, /"Raw results"/);

    // Switching to English must restore the untouched source presentation.
    const enUi = await request("reload_aether_extensions", { context: { platform: "android", language: "en" } });
    const enSnapshot = JSON.stringify(enUi.snapshot);
    assert.match(enSnapshot, /Web Access/);
    assert.match(enSnapshot, /All eligible providers/);
    assert.match(enSnapshot, /MCP Servers/);
    assert.match(enSnapshot, /Subagents/);
    assert.match(enSnapshot, /Add MCP server/);
    assert.match(enSnapshot, /Subagent Types/);
    assert.match(enSnapshot, /Create agent definition/);
    assert.match(enSnapshot, /Context Extraction/);
    assert.match(enSnapshot, /Privacy and network/);
    assert.match(enSnapshot, /Raw results/);

    const disabled = names.map(name => join(root, name));
    await request("reload_all_extensions", { disabled_extension_paths: disabled, disabled_package_sources: [] });
    await request("run_turn", { ...turn, disabled_extension_paths: disabled });
    const after = await request("list_extensions", { session_id: turn.session_id });
    assert.ok(after.extension_paths.every(p => !p.startsWith(root + "/")), JSON.stringify(after));
    console.log(`Bundled native registration: ${inventory.extension_paths.length}; tools: ${inventory.tools.length}; UI settings: ${ui.snapshot.settings.length}; RU/EN localization: PASS; disable/reload: PASS`);
  } finally {
    for (const waiter of pending.values()) clearTimeout(waiter.timer);
    lines.close();
    child.kill("SIGKILL");
    await new Promise(resolve => child.once("close", resolve));
    await rm(home, { recursive: true, force: true });
  }
});
