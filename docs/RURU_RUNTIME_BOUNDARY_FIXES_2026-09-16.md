# Runtime boundaries: R06/R08 — 2026-09-16

Integrated base: `e76a9e8e9966c3dd387f72ede2c9c96e73043450`.
PRs #10/#11/#12/#13 are preserved byte-for-byte except for the R06/R08 files
listed below. The independently merged R11 deletion contract in #13 is retained;
the competing low-level removal implementation and its tests were removed.
No Nightly, signing, application ID or chat storage changes.

## R06 — asynchronous extension waits

The existing serialized runtime remains in place. Load/render/action/event/cleanup
waits receive phase budgets: render 10 s, action 120 s, event 30 s, cleanup 5 s,
load 120 s. Existing error boundaries record a timeout and continue; one hanging
cleanup or event handler no longer indefinitely starves the later handlers.

An AsyncLocalStorage scope follows the operation. Calls through the extension API
are checked at invocation time, including destructured methods and registration
disposers. A timed-out continuation is rejected when it subsequently calls that
API. Successful detached callbacks remain supported.

This is a reliability boundary, **not a sandbox**. It cannot preempt synchronous
infinite JS, undo arbitrary raw filesystem/process effects or cancel host calls
already in flight. Extensions still own external timers, callbacks and cleanup.
The lock remains serialized for healthy operations: this is not a worker-based
runtime redesign or full hot-unload.

## R08 — Android event buffering

Per-request FIFO channels are limited to 1,024 events. The shared stdout reader
must never block: a handler can be waiting on another RPC carried by that reader.
Overflow reports `event_queue_overflow` rather than silently dropping results or
conflating tool events. Local queue/consumer resources are cancelled; cancellable
requests receive an exact-request abort, subscriptions receive unsubscribe.
Remote cleanup cannot start a Node process or target another process generation.

The limit bounds the **number** of events, not one frame's byte size. Normal
stream bursts, UI responsiveness and peak RAM need a physical-device stress test.

## TDD evidence

GitHub run 35076165051 reproduced four deadline failures before implementation;
the successful detached-callback test passed. Run 35076578645 passed those cases
after the implementation (its separate removal tests were later superseded by
PR #13). The final `runtime-boundaries.test.mjs` retains the five R06 cases.

GitHub run 35076769260 compiled Android successfully, then failed the capacity
test as expected with the old unbounded channel. FIFO passed. Permanent unit
tests now also distinguish an overflowing channel from a closed channel.

Final verification comes from PR Check, runtime regression and bundled extension
typecheck jobs on the final commit, not from this document. No on-device or paid
provider testing is claimed.

## Files and rollback

- `pi-bridge/src/extension-operation.ts`: timeout scopes/API guards.
- `pi-bridge/src/aether-extensions.ts`: boundaries at load/render/action/event/cleanup.
- `app/.../PiBridgeEventQueue.kt`: bounded FIFO and explicit overflow code.
- `app/.../PiKernelBridge.kt`: queue integration and targeted overflow cleanup.
- Tests: `runtime-boundaries.test.mjs`, `PiBridgeEventQueueTest.kt`.

Revert the PR as a unit. There is no data migration or signing change to reverse.
