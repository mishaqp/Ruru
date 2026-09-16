# Ruru: extension contracts and typecheck coverage

Base: `3acd2343e90fd2616021b0ac89154a9e4cfaa9a8`, after PR #10.

## Scope

This follow-up closes audit R09 (full built-in extension typechecks) and R10 (copied Aether contracts). It does not claim to repair R06 (global async-handler lock), R08 (Android event-queue bounds), or R11 (uniform removal/reload reporting). The runtime, localization, managed-bundle and cancellation repairs already merged in PR #10 are preserved.

## Changes

- MCP, Subagents and Web Access import the existing `@baimoqilin/aether-extension-api` types rather than redeclaring them. MCP retains its public type exports. Only declarations are imported/exported: no second SDK and no new runtime SDK dependency.
- TypeScript resolves the canonical SDK's generated declarations during development checks. `scripts/check-bundled-extensions.mjs` builds/checks that SDK before checking every source file in the selected package.
- Package and SDK lockfiles make these checks reproducible. Each extension is checked against the same Pi versions as `pi-bridge/package.json`; a drift fails explicitly.
- Web Access was missing check-time Pi and Node declarations. These are now explicit development dependencies; its Node types and strict checking are explicit.
- Real typechecking exposed the stale one-argument `registerAction` declaration in Web Access. The common SDK supplies the actual two-argument host contract.
- Real typechecking also exposed Pi's nullable provider headers. Requests delegated to Pi retain its actual header type unchanged. Direct OpenAI/xAI fetch adapters filter out null markers rather than forwarding a literal null header; non-null values and existing authorization selection are preserved.
- The new PR workflow checks all three packages, fails normally on errors, and has no APK publication or Nightly trigger.

## Regression evidence

Before replacing declarations, the SDK guard failed in all three UI entrypoints for copied contracts (run `35072252544`). After replacement the three guards passed. Before filtering direct HTTP headers, both provider tests failed on the returned `x-remove: null` value (run `35072933817`). These were genuine assertion failures, not missing-tool failures.

All three complete package typechecks passed in run `35073169490`, including a negative coverage probe: an intentionally invalid number assignment is placed in each real source directory, must cause TS2322, and is removed in `finally`. A green command that silently skips source files is therefore rejected.

The permanent `pi-bridge` tests also assert that SDK imports/exports disappear from emitted JavaScript and that direct HTTP adapters preserve header values without mutating provider registry data. Existing clean bundled-runtime/RU-EN/disable tests remain in the standard runtime workflow. Final head-specific runtime and Android results are recorded on the pull request; passing typechecks are not a claim of device testing.

## Re-run

From the repository root with Node/npm installed:

```sh
node scripts/check-bundled-extensions.mjs
# Or check one package:
node scripts/check-bundled-extensions.mjs pi-web-access
```

Bridge tests still run separately with `npm ci && npm run check && npm test` inside `pi-bridge`; Android/shared unit tests and `assembleDebug` remain in PR Check.

## Compatibility and rollback

No application ID, version code, signing certificate, tool ID, model/provider ID, persisted value, prompt, or RU/EN resource changes. No Nightly build is requested or added. Temporary mutation/probe workflows are removed from the final diff. Reverting this PR restores the previous compile-time contracts; no user-data migration is needed.
