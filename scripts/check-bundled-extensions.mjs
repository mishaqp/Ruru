import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// These are compile-time checks. Runtime loading and Android checks remain separate.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const names = ["pi-mcp-adapter", "pi-subagents", "pi-web-access"];
const requested = process.argv.slice(2);
const selected = requested.length ? requested : names;
assert.ok(selected.every(name => names.includes(name)), "Unknown bundled extension");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const installArgs = ["ci", "--ignore-scripts", "--include=dev", "--include=optional", "--legacy-peer-deps", "--no-audit", "--no-fund"];

function run(cwd, args, capture = false) {
  const result = spawnSync(npm, args, {
    cwd,
    stdio: capture ? "pipe" : "inherit",
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 8 * 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`npm ${args.join(" ")} terminated by ${result.signal}`);
  return result;
}

function requireSuccess(cwd, args) {
  const result = run(cwd, args);
  if (result.status !== 0) throw new Error(`npm ${args.join(" ")} failed (${result.status}) in ${cwd}`);
}

const sdk = join(root, "packages/extension-api");
requireSuccess(sdk, installArgs);
requireSuccess(sdk, ["run", "check"]);
const host = JSON.parse(await readFile(join(root, "pi-bridge/package.json"), "utf8"));

for (const name of selected) {
  const cwd = join(root, "extensions", name);
  const manifest = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"));
  for (const dependency of ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent", "@earendil-works/pi-tui"]) {
    assert.equal(manifest.devDependencies?.[dependency], host.dependencies[dependency], `${name}: check against the Pi version actually bundled by the host`);
  }
  requireSuccess(cwd, installArgs);
  requireSuccess(cwd, ["run", "typecheck"]);

  // A green command must actually cover the package's source directory. This
  // deliberately invalid file is isolated, never committed and always removed.
  const probeName = "ruru_typecheck_probe.ts";
  const probe = join(cwd, name === "pi-subagents" ? "src" : ".", probeName);
  await writeFile(probe, 'export const ruruTypecheckProbe: number = "must fail";\n', { flag: "wx" });
  try {
    const result = run(cwd, ["run", "typecheck"], true);
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert.notEqual(result.status, 0, `${name}: typechecker silently accepted an invalid number`);
    assert.match(output, /ruru_typecheck_probe\.ts/, `${name}: failure must be from the injected source file`);
    assert.match(output, /TS2322/, `${name}: expected a type mismatch, not a tooling failure`);
  } finally {
    await unlink(probe);
  }
  console.log(`${name}: full source typecheck PASS; invalid-type coverage probe PASS`);
}
