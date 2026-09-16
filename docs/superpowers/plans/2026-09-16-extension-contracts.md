# Extension contract repair plan

## Scope and constraints

Base: `3acd2343e90fd2616021b0ac89154a9e4cfaa9a8` (PR #10 already merged).
Preserve `com.mishaqp.ruru`, release signing, RU/EN presentation, all tools/providers and chat data. No Nightly build or automatic Nightly trigger. Work through GitHub and GitHub Actions; no local clone.

## R09/R10: one checked API contract

- [x] Run the compiler against every source included by the three bundled packages' existing tsconfigs. Diagnostic run `35073904011` found Web Access's incorrect one-argument action contract and missing compiler-only cross-spawn declarations; Subagents passed.
- [ ] Replace duplicated Aether API/view/settings types with type-only imports from `@baimoqilin/aether-extension-api`. Preserve existing exported type names in MCP.
- [ ] Build and check the existing SDK declarations. Use the bridge's pinned TypeScript/Pi versions for all bundled checks; do not disable existing strictness flags.
- [ ] Add a dedicated CI check which installs runtime dependencies without executing install hooks, typechecks each package, and fails on any compiler error. Check that all tracked TypeScript implementation files are covered.
- [ ] Run the real standalone bundled-runtime test to prove type-only SDK imports introduce no runtime dependency.

## R11: observable, consistent removal

Preserve the low-level disk-only removal operation used by archive restore. High-level Android/shared agent management must request exactly one reload, return its actual scheduled/completed state, and not change the enabled preference before successful deletion.

- [ ] Add management tests for remove -> reload, deferred reload, missing package, reload failure and cancellation.
- [ ] Reproduce the missing shared reload before changing production code.
- [ ] Retain the Android UI's Result<Unit> wrapper and expose detailed removal results to its agent-facing caller.
- [ ] Do not claim that a busy session is immediately unloaded. Preserve full reload diagnostics.

## Verification and integration

- [ ] Locale validator; bridge TypeScript; SDK and all bundled types; Node regressions and real bundled load.
- [ ] Android/shared unit tests and arm64-v8a assembleDebug in Actions.
- [ ] Inspect the final PR diff; remove temporary self-writing development workflows/scripts before merging.
- [ ] Merge only after final-head required checks succeed. Keep stable signing and Nightly manual-only.

## Explicit boundary

R06 (uncooperative extension-handler lifetime) and R08 (queue flow control) need separate ownership/transport changes and stress tests. This PR must not pretend that a Promise.race cancels arbitrary extension code, or silently drop tool/result events by shrinking a Channel. Existing PR #10 repairs are retained; these two risks are not declared solved by contract/typecheck work.
