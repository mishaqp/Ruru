# Extension contract repair plan

## Scope

Base: `3acd2343e90fd2616021b0ac89154a9e4cfaa9a8` (PR #10 already merged).
Preserve `com.mishaqp.ruru`, permanent release signing, RU/EN, arm64-v8a, tools/providers and chat data. No Nightly APKs or automatic Nightly triggers. All source changes and execution are through GitHub and Actions; no local clone.

## R09/R10: checked shared API — implemented

- Replaced all three bundled Aether API/view/settings copies with erased type-only imports from the existing `@baimoqilin/aether-extension-api`. MCP's public type exports remain available.
- Built and tested SDK declarations. Bundled checks use bridge-pinned TypeScript 5.9.3 and Pi 0.85.1, without weakening existing tsconfig flags.
- Added a required-to-pass PR job for all tracked implementation sources: MCP 60, Subagents 40, Web Access 52. Coverage enumeration fails when a tracked TS implementation is omitted.
- Added compiler-only cross-spawn/turndown declarations; no runtime dependency version was changed.
- Verified that transpilation erases SDK imports and the standalone bundled runtime loads without compiler-only dependency links.

Evidence: diagnostic run `35073904011` found Web Access callbacks using a second argument that its copied interface did not permit. Run `35075557689`, job `104727140329`, passed SDK checks, all 152 bundled sources, bridge TypeScript, locale parity and 63/63 Node tests including the real bundled runtime.

## R11: observable removal — implemented

The low-level disk-only bridge operation remains unchanged because archive restoration batches removals. A single shared helper now handles high-level Android/shared removal.

- Exactly one reload after successful deletion; no reload for a missing package.
- Preserve `removed=true` when subsequent application fails; include raw reload diagnostics.
- Report `reload_status=scheduled|completed|failed|not_removed` and truthful `effective_on_next_turn` only when application is confirmed/scheduled.
- Clear the enabled/disabled preference only after successful deletion.
- Preserve cancellation instead of reporting it as completed work.
- Retain Android UI's `Result<Unit>` wrapper; the agent receives the detailed result.
- Android declares the same existing JSON library used by shared, since the helper exposes JSON at the module boundary.

Evidence: four management tests failed with expected assertions before the fix (run `35074906448`, job `104724888883`). After the fix, all four management tests and seven helper tests passed (154 shared tests, zero failures). Final Android compilation/build must also pass the PR Check before merge.

## Integration gate

Temporary self-writing workflows and patch scripts have been removed. The final PR must pass PR Check (Android/shared unit tests + assembleDebug), Runtime regression checks and Bundled extension contracts at its final head before merge. Build only a signed stable release after merge; leave Nightly manual-only.

## Explicit boundary

R06 (uncooperative extension-handler lifetime) and R08 (queue flow control) remain open. They need separate ownership/transport changes and stress tests. A timeout alone does not cancel arbitrary extension code; shrinking a Channel must not silently lose protocol events. Existing PR #10 repairs are retained, but these two risks are not declared solved by this patch.
