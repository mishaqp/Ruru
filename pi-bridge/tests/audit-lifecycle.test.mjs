import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

test("R07: a failed reload must not resurrect an explicitly disabled extension", { timeout: 30_000 }, async () => {
  const home = await mkdtemp(join(tmpdir(), "ruru-disabled-rollback-"));
  const root = join(home, ".aether", "extensions");
  const good = join(root, "good");
  const bad = join(root, "bad");
  await mkdir(good, { recursive: true });
  await writeFile(join(good, "package.json"), JSON.stringify({ name: "good", aether: { api: 2, extensions: ["./aether.ts"] } }));
  await writeFile(join(good, "aether.ts"), `export default a => { a.registerSettings({id:'good',title:'Good',sections:[]}); };`);
  const child = spawn(process.execPath, [resolve("dist/extension-bridge.mjs")], {
    env: { ...process.env, HOME: home, USERPROFILE: home, PI_CODING_AGENT_DIR: join(home, ".pi", "agent") },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const pending = new Map();
  let sequence = 0;
  let stderr = "";
  const closed = new Promise(resolve => child.once("close", resolve));
  child.stderr.on("data", bytes => { stderr = (stderr + bytes.toString()).slice(-12_000); });
  const lines = createInterface({ input: child.stdout });
  lines.on("line", line => {
    let frame;
    try { frame = JSON.parse(line); } catch { return; }
    if (frame.type === "event") return;
    const waiter = pending.get(frame.id);
    if (!waiter) return;
    pending.delete(frame.id); clearTimeout(waiter.timer);
    if (frame.type === "error" || frame.ok === false) waiter.reject(new Error(JSON.stringify(frame.error)));
    else waiter.resolve(frame.payload);
  });
  const request = payload => new Promise((resolve, reject) => {
    const id = `rollback-${++sequence}`;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${stderr}`)); }, 10_000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ id, type: "reload_aether_extensions", payload }) + "\n");
  });
  try {
    const first = await request({});
    assert.ok(first.snapshot.extensions.some(e => e.name === "good"));
    await mkdir(bad);
    await writeFile(join(bad, "package.json"), JSON.stringify({ name: "bad", aether: { api: 2, extensions: ["./aether.ts"] } }));
    await writeFile(join(bad, "aether.ts"), "export default () => { throw new Error('fixture failed load'); };");
    const second = await request({ disabled_extension_paths: [good], disabled_package_sources: [] });
    assert.ok(second.errors.some(e => e.error.includes("fixture failed load")));
    assert.equal(second.snapshot.extensions.some(e => e.name === "good"), false, "disabled extension survives failed reload");
    assert.equal(second.snapshot.settings.some(e => e.local_id === "good"), false);
  } finally {
    for (const waiter of pending.values()) clearTimeout(waiter.timer);
    lines.close(); child.kill("SIGKILL"); await closed;
    await rm(home, { recursive: true, force: true });
  }
});
