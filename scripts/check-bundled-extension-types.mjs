import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, symlinkSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modules = join(root, "pi-bridge/node_modules");
const sdk = join(root, "packages/extension-api");
const compiler = join(modules, "typescript/bin/tsc");
const names = ["pi-mcp-adapter", "pi-subagents", "pi-web-access"];
const createdLinks = [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
    timeout: 300_000, ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.error?.message ?? result.status}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}

function linkCheckingDependency(target, link) {
  if (existsSync(link)) {
    assert.equal(realpathSync(link), realpathSync(target), `Refusing to replace existing dependency: ${link}`);
    return;
  }
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
  createdLinks.push(link);
}

assert.ok(existsSync(compiler), "Run npm ci --prefix pi-bridge first.");
assert.ok(existsSync(join(sdk, "dist/index.d.ts")), "Build packages/extension-api first.");
const require = createRequire(join(root, "pi-bridge/package.json"));
const ts = require("typescript");
console.log(`Checking bundled source with TypeScript ${ts.version}; runtime dependencies match the pinned bridge.`);

try {
  // Compiler-only lookup: no SDK dependency is added to runtime packages.
  // The standalone runtime test runs in a different HOME with no such links.
  linkCheckingDependency(modules, join(root, "node_modules"));
  linkCheckingDependency(sdk, join(modules, "@baimoqilin/aether-extension-api"));
  for (const name of names) {
    const directory = join(root, "extensions", name);
    run(process.platform === "win32" ? "npm.cmd" : "npm", [
      "install", "--prefix", directory, "--omit=dev", "--omit=optional",
      "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false",
    ]);
    const output = run(process.execPath, [compiler, "-p", join(directory, "tsconfig.json"), "--noEmit", "--pretty", "false", "--listFiles"]);
    const checked = new Set(output.split(/\r?\n/).filter(line => line.startsWith(root)).map(line => resolve(line.trim())));
    const sources = run("git", ["ls-files", "-z", "--", `extensions/${name}`]).split("\0")
      .filter(file => /\.(?:[cm]?ts)$/.test(file) && !/\.d\.[cm]?ts$/.test(file));
    const missed = sources.filter(file => !checked.has(resolve(root, file)));
    assert.deepEqual(missed, [], `${name}: tracked TypeScript sources omitted from typechecking`);
    const uiPath = join(directory, name === "pi-subagents" ? "src/aether.ts" : "aether.ts");
    const uiSource = readFileSync(uiPath, "utf8");
    assert.doesNotMatch(uiSource, /(?:interface|type)\s+AetherExtensionAPI\b/, `${name}: duplicate API contract`);
    assert.match(uiSource, /from\s+["']@baimoqilin\/aether-extension-api["']/);
    const js = ts.transpileModule(uiSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    assert.doesNotMatch(js, /@baimoqilin\/aether-extension-api/, `${name}: SDK import leaked into runtime JavaScript`);
    console.log(`${name}: PASS; ${sources.length} tracked TypeScript sources checked; shared contract, no runtime SDK import.`);
  }
} finally {
  for (const link of createdLinks.reverse()) {
    if (lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) unlinkSync(link);
  }
}
