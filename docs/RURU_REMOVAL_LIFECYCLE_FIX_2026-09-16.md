# Ruru: truthful extension removal (R11)

## Scope and concurrent changes

The original audit-stability base was PR #10, `3acd2343e90fd2616021b0ac89154a9e4cfaa9a8`. While this patch was being verified, PR #11 independently merged canonical API contracts and full typechecks as `bb464252cf62f0f5d79dfe0e42378db2da457e5f`. Its entire tree is preserved: this follow-up now contains only removal changes, the Android JSON classpath declaration, and 11 tests. Duplicate CI/type migration work and temporary development patchers are absent from the final diff.

## R11 repair

The low-level disk-only `remove_extension_package` operation remains unchanged, because archive restoration batches removals. High-level Android/shared management uses one shared helper.

- Request exactly one reload after successful removal; do not reload a missing package.
- Return `reload_status=scheduled|completed|failed|not_removed` rather than falsely claiming immediate hot-unload.
- When a session is busy, expose `effective_on_next_turn=true` and say that current work may still use old code.
- Preserve `removed=true` if the following reload fails, along with the actual diagnostic. Do not invent an applied state when the reload response is missing/incomplete.
- Clear the previous enabled/disabled preference only after successful deletion, never before it.
- Propagate cancellation instead of treating it as successful completion.
- Keep Android UI's existing `Result<Unit>` wrapper; give the Android/shared agent the detailed JSON response.
- Explicitly declare the existing shared JSON library on Android's compile classpath; no runtime version change.

## Evidence and merge gate

Four tests of the real SharedAgentManagementTools + SharedPiBridgeClient failed with expected assertions before the production fix (Actions run 35074906448, job 104724888883). All four and seven additional helper tests subsequently passed (154 shared tests, zero failures). Cases cover deferred/immediate reload, missing package, deletion failure, reload failure, incomplete responses, preference ordering and cancellation.

Before merging, final-head PR Check must pass Android/shared unit tests and assembleDebug. Runtime regression checks and the extension typecheck jobs inherited from PR #11 must also pass. Device installation has not been claimed by these JVM/Node checks.

## Compatibility and limits

Preserve application ID `com.mishaqp.ruru`, arm64-v8a, permanent signing certificate, RU/EN, provider/model/tool IDs and chat data. No Nightly build; the Nightly workflow remains manual-only. A safe boundary recreation is not hot-unload.

R06 (uncooperative extension-handler lifetime) and R08 (event-queue flow control) remain open and require separate cancellation/ownership and stress-test work. These are not declared fixed here. Reverting this patch requires no persisted-data migration.
