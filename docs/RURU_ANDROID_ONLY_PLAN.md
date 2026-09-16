# Ruru: Android-only stability follow-up

Base: bb464252cf62f0f5d79dfe0e42378db2da457e5f (PR #11).

Owner scope: Android arm64-v8a only. Do not build or repair iOS/macOS, do not create nightly APKs. Keep shared source dependencies needed by Android. Keep com.mishaqp.ruru, the permanent release signing key, existing data and RU/EN.

Already merged: audit R01/R02/R03/R04/R05/R07/R09/R10/R12/R13 via PR #10 and #11. Do not redo those changes.

This follow-up:
1. Remove the remaining manual Nightly workflow and enforce Android-only CI policy.
2. R06: reproduce hung extension callbacks; introduce bounded, owner-aware callback execution, revoke SDK access after timeout/disposal, expose cooperative cancellation and keep other extensions usable. This is not a sandbox: arbitrary synchronous loops/native calls/direct filesystem operations cannot be forcibly terminated by a JavaScript timeout.
3. R08: bound the Android event queue; on overload report an explicit error and abort only the affected request rather than silently discarding events or blocking the shared reader.
4. R11: preserve the existing Android single-reload deletion path, return the actual reload/scheduled state to the agent instead of implying immediate unload.
5. Validate regressions, locale parity, all extension typechecks, Android/shared unit tests and arm64-v8a APK assets. Inspect the final PR diff before merge. Publish only a signed stable Android release after green checks.

Implementation must retain teardown callbacks and normal SDK behaviour. Regression tests must demonstrate the old failure first. No device tests can be claimed without a real connected device.
