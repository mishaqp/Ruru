import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createJiti } from "jiti";
import { build } from "esbuild";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { localizeAetherUiSnapshot } = await jiti.import(resolve("src/aether-ui-i18n.ts"));
const { ensureExtensionPackageDependencies } = await jiti.import(resolve("src/extension-dependencies.ts"));

test("R01: RU translates presentation but preserves every action argument and opaque value", () => {
  const opaque = { text: "Model", message: "Close", description: "Auto", nested: [{ label: "Yes" }] };
  const source = {
    settings: [{ title: "Model", sections: [{ settings: [{
      label: "Auto", args: opaque, editArgs: opaque, deleteArgs: opaque,
      trailing_args: opaque, trailingArgs: opaque, value: opaque, default: opaque,
      payload: opaque, data: opaque, schema: opaque, parameters: opaque,
      options: [{ label: "Yes", value: "Yes" }],
    }] }] }],
    surfaces: [{ tree: { type: "button", label: "Close", action: "Close", args: opaque } }],
  };
  const before = structuredClone(source);
  const result = localizeAetherUiSnapshot(source, { language: "ru" });
  assert.equal(result.settings[0].title, "Модель");
  const setting = result.settings[0].sections[0].settings[0];
  assert.equal(setting.label, "Авто");
  for (const key of ["args", "editArgs", "deleteArgs", "trailing_args", "trailingArgs", "value", "default", "payload", "data", "schema", "parameters"]) {
    assert.deepEqual(setting[key], opaque, `${key} is not presentation`);
  }
  assert.deepEqual(setting.options, [{ label: "Да", value: "Yes" }]);
  assert.equal(result.surfaces[0].tree.label, "Закрыть");
  assert.equal(result.surfaces[0].tree.action, "Close");
  assert.deepEqual(result.surfaces[0].tree.args, opaque);
  assert.deepEqual(source, before, "localization must not mutate its input");
  assert.deepEqual(localizeAetherUiSnapshot(source, { language: "en" }), before);
});

test("R01: code and web content remain byte-identical in RU", () => {
  const source = { surfaces: [{ tree: { type: "column", children: [
    { type: "code", text: "Model", language: "text" },
    { type: "web", text: "Close", html: "<label>Model</label>" },
    { type: "text", text: "Model" },
  ] } }] };
  const nodes = localizeAetherUiSnapshot(source, { language: "ru" }).surfaces[0].tree.children;
  assert.equal(nodes[0].text, "Model");
  assert.equal(nodes[1].text, "Close");
  assert.equal(nodes[1].html, "<label>Model</label>");
  assert.equal(nodes[2].text, "Модель");
});

test("R12: changing only package-lock invalidates installed dependency marker", async () => {
  const root = await mkdtemp(join(tmpdir(), "ruru-lockfile-"));
  const bin = join(root, "bin");
  const pkg = join(root, "package");
  const counter = join(root, "calls.txt");
  const previousPath = process.env.PATH;
  const previousCounter = process.env.RURU_NPM_COUNTER;
  try {
    await mkdir(bin);
    await mkdir(pkg);
    await writeFile(join(bin, "npm"), `#!${process.execPath}\nrequire('node:fs').appendFileSync(process.env.RURU_NPM_COUNTER, 'install\\n');\n`);
    await chmod(join(bin, "npm"), 0o755);
    await writeFile(join(pkg, "package.json"), JSON.stringify({ dependencies: { fixture: "^1.0.0" } }));
    await writeFile(join(pkg, "package-lock.json"), '{"lockfileVersion":3,"fixture":"1.0.0"}');
    process.env.PATH = `${bin}:${previousPath}`;
    process.env.RURU_NPM_COUNTER = counter;
    await ensureExtensionPackageDependencies(pkg);
    await ensureExtensionPackageDependencies(pkg);
    assert.equal((await readFile(counter, "utf8")).trim().split("\n").length, 1);
    await writeFile(join(pkg, "package-lock.json"), '{"lockfileVersion":3,"fixture":"1.0.1"}');
    await ensureExtensionPackageDependencies(pkg);
    assert.equal((await readFile(counter, "utf8")).trim().split("\n").length, 2);
  } finally {
    if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath;
    if (previousCounter === undefined) delete process.env.RURU_NPM_COUNTER; else process.env.RURU_NPM_COUNTER = previousCounter;
    await rm(root, { recursive: true, force: true });
  }
});

// Exercise the real runner, replacing only its external runtime/configuration
// dependencies. No model request, API credential or real user session is used.
const fixtureKey = "ruru.audit.runner.fixture";
async function loadRunner(fixture) {
  globalThis[Symbol.for(fixtureKey)] = fixture;
  const preamble = `const f = globalThis[Symbol.for(${JSON.stringify(fixtureKey)})];\n`;
  const stubs = {
    "@earendil-works/pi-coding-agent": preamble + `
      export const getAgentDir = () => '/fixture';
      export class DefaultResourceLoader { async reload() { await f.step('loader'); } getExtensions() { return { extensions: [], errors: [] }; } }
      export const SettingsManager = { create: () => ({ getSessionDir: () => undefined }) };
      export const SessionManager = { inMemory: () => ({}), create: () => ({}), open: () => ({}) };
      export async function createAgentSession() { await f.step('create'); return { session: f.session }; }
    `,
    "./agent-types.js": `export const BUILTIN_TOOL_NAMES=[];
      export const getConfig=()=>({extensions:false,skills:false});
      export const getAgentConfig=()=>({name:'fixture',persistSession:false});
      export const getToolNamesForType=()=>[]; export const getMemoryToolNames=()=>[]; export const getReadOnlyMemoryToolNames=()=>[];`,
    "./child-context.js": "export const runInChildSessionContext = fn => fn();",
    "./context.js": "export const buildParentContext=()=>''; export const extractText=()=>'';",
    "./default-agents.js": "export const DEFAULT_AGENTS=new Map();",
    "./env.js": preamble + "export const detectEnv=async()=>{await f.step('environment');return {};};",
    "./memory.js": "export const buildMemoryBlock=()=>''; export const buildReadOnlyMemoryBlock=()=>'';",
    "./nested-tools.js": "export const createNestedSubagentTools=()=>[]; export const getMaxSubagentDepth=()=>0;",
    "./prompts.js": "export const buildAgentPrompt=()=>'';",
    "./skill-loader.js": "export const preloadSkills=()=>[];",
  };
  const built = await build({
    entryPoints: [resolve("../extensions/pi-subagents/src/agent-runner.ts")],
    bundle: true, platform: "node", format: "esm", write: false,
    plugins: [{ name: "isolated-runner-fixture", setup(b) {
      b.onResolve({ filter: /.*/ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: "fixture" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "js" }));
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text + `\n//${Math.random()}`).toString("base64")}`);
}

function runnerFixture(controller, abortAt) {
  const counts = { prompts: 0, disposed: 0, aborted: 0 };
  const fixture = {
    counts,
    async step(stage) { if (stage === abortAt) controller.abort(); },
    session: {
      messages: [], setSessionName() {},
      async bindExtensions() { await fixture.step("bind"); },
      subscribe() { return () => {}; },
      async prompt() { counts.prompts++; },
      async abort() { counts.aborted++; },
      dispose() { counts.disposed++; },
    },
  };
  return fixture;
}

for (const stage of ["before", "environment", "loader", "create", "bind"]) {
  test(`R02: abort at ${stage} never starts a subagent model prompt`, async () => {
    const controller = new AbortController();
    const fixture = runnerFixture(controller, stage);
    const { runAgent } = await loadRunner(fixture);
    if (stage === "before") controller.abort();
    const ctx = { cwd: "/fixture", getSystemPrompt: () => "", modelRegistry: {}, model: undefined };
    await assert.rejects(runAgent(ctx, "fixture", "no network", {
      pi: {}, signal: controller.signal, isolated: true, model: { id: "fixture", provider: "fixture" },
    }), error => error?.name === "AbortError");
    assert.equal(fixture.counts.prompts, 0, "cancelled startup must not spend model tokens");
    if (stage === "create" || stage === "bind") assert.ok(fixture.counts.disposed > 0, "created session must be disposed");
  });
}

test("R02: normal subagent startup still delivers a prompt", async () => {
  const controller = new AbortController();
  const fixture = runnerFixture(controller, "never");
  const { runAgent } = await loadRunner(fixture);
  await runAgent({ cwd: "/fixture", getSystemPrompt: () => "", modelRegistry: {} }, "fixture", "no network", {
    pi: {}, signal: controller.signal, isolated: true, model: { id: "fixture", provider: "fixture" },
  });
  assert.equal(fixture.counts.prompts, 1);
  assert.equal(fixture.counts.disposed, 0, "successful session must remain resumable");
});

test("R13: Android diagnostics agree with the locked Pi package versions", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  const kotlin = await readFile("../app/src/main/java/com/zhousl/aether/data/pi/PiKernelBridge.kt", "utf8");
  for (const [constant, dependency] of [["PiAiVersion", "pi-ai"], ["PiAgentCoreVersion", "pi-agent-core"], ["PiCodingAgentVersion", "pi-coding-agent"]]) {
    const value = kotlin.match(new RegExp(`private const val ${constant} = "([^"]+)"`))?.[1];
    assert.equal(value, manifest.dependencies[`@earendil-works/${dependency}`], constant);
  }
});
