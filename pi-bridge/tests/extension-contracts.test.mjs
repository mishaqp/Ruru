import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const sdk = "@baimoqilin/aether-extension-api";
const entries = [
  "../../extensions/pi-mcp-adapter/aether.ts",
  "../../extensions/pi-subagents/src/aether.ts",
  "../../extensions/pi-web-access/aether.ts",
];

for (const entry of entries) {
  test(`bundled UI uses one shared contract without a runtime SDK dependency: ${entry}`, async () => {
    const url = new URL(entry, import.meta.url);
    const source = await readFile(url, "utf8");
    const ast = ts.createSourceFile(url.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const copied = ast.statements.filter(node =>
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      /^Aether(?:ExtensionAPI|Setting|Settings|Ui|View|RenderContext|JsonObject|MessageType)/.test(node.name.text));
    assert.deepEqual(copied.map(node => node.name.text), [], "Do not redeclare the host SDK contract inside bundled extensions");
    const imports = ast.statements.filter(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === sdk);
    assert.ok(imports.length > 0, "Import the existing shared SDK contract");
    assert.ok(imports.every(node => node.importClause?.isTypeOnly), "SDK imports must be erased, not loaded at runtime");
    assert.ok(imports.some(node => node.importClause.namedBindings?.elements?.some(item => item.name.text === "AetherExtensionAPI")));
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true },
    });
    const emitted = ts.createSourceFile("emitted.js", outputText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    assert.ok(!emitted.statements.some(node =>
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier?.text === sdk),
    "Type-only SDK imports/exports must not pull the SDK into the Pi/Aether loader graphs");
  });
}
