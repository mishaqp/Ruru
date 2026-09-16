import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

async function loadAdapter(name) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(`../../extensions/pi-web-access/${name}.ts`, import.meta.url))],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

for (const [adapter, resolveName, provider, modelId] of [
  ["openai-search", "resolveOpenAIAuth", "openai", "gpt-4.1-mini"],
  ["xai-search", "resolveXaiAuth", "xai", "grok-4.5"],
]) {
  test(`${adapter} omits null provider headers and preserves real header values`, async () => {
    const module = await loadAdapter(adapter);
    const model = { provider, id: modelId };
    const headers = { "x-keep": "unchanged", "x-remove": null, "x-empty": "" };
    const ctx = {
      modelRegistry: {
        getAll: () => [model],
        find: () => model,
        getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "local-test-only", headers }),
      },
    };
    const auth = await module[resolveName](ctx);
    assert.ok(auth);
    assert.deepEqual(auth.headers, { "x-keep": "unchanged", "x-empty": "" });
    assert.equal(auth.apiKey, "local-test-only");
    assert.deepEqual(headers, { "x-keep": "unchanged", "x-remove": null, "x-empty": "" }, "Do not mutate the provider registry response");
  });
}
