# Extension contract audit repairs

Base: `3acd2343e90fd2616021b0ac89154a9e4cfaa9a8` (PR #10 already merged).

## Goal and constraints

Close R09/R10 incrementally: built-in MCP/Subagents/Web Access must compile against the existing Aether SDK and have enforceable package typechecks. No local clone: investigation uses the GitHub connector; execution uses isolated GitHub Actions checkouts. No Nightly builds, no applicationId/signing changes, no runtime API version bumps, no removal of features. Do not claim R06/R08/R11 repaired by this type-contract change.

## Design

Use `import type` from the existing `@baimoqilin/aether-extension-api` module, preserving MCP's public type re-exports. Resolve its declarations at check time from `packages/extension-api`; do not add runtime imports/dependencies or a second SDK. Run package checks with the Pi versions actually pinned by the host. Keep runtime integration tests separate: a successful transpilation is not a full typecheck and a successful typecheck is not a device test.

## Execution

- [ ] Run each existing package typecheck on unchanged production source; capture exact failures, including broken/missing tooling and incompatible dependency types.
- [ ] Add a regression test that rejects copied Aether contracts and verifies TypeScript erases SDK imports from runtime output. Run it on the old code and observe the three expected failures.
- [ ] Replace local Aether type declarations with shared imports; preserve exports and runtime behavior. Check actual call sites before adapting narrow types.
- [ ] Add an executable repository check command and required PR workflow covering all three packages. Pin build tooling and avoid success-by-skipping or blanket `any` / disabled diagnostics. Fix only reproduced errors; record any remaining limitation rather than mask it.
- [ ] Verify the guard detects an intentionally invalid type in an isolated temporary file; remove the injected error before normal checks.
- [ ] Run locale validation, TypeScript, all Node bridge/bundled regressions, Android/shared tests and assembleDebug. Inspect the final diff and remove temporary development workflows.
- [ ] Open a PR, verify the final head's checks, merge only on green and confirm Nightly was not triggered.

## Rollback

The SDK migration has no persisted data migration. Reverting the PR restores previous local declarations; bridge runtime APIs and installed user configuration remain unchanged.
