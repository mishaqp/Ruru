# Runtime boundary fixes — 2026-09-16

Base: `bb464252cf62f0f5d79dfe0e42378db2da457e5f` (PRs #10 and #11 already merged).
This change addresses the remaining independent-audit findings R06, R08 and R11.
No Nightly build or Nightly workflow change is required. Application ID, signing,
provider/model/tool identifiers and saved chat formats are unchanged.

## R06 — asynchronous extension handlers cannot hold the queue indefinitely

The existing serialized runtime is retained; removing its lock would introduce
registration/snapshot races. Load/render/action/event/cleanup waits receive phase
budgets: render 10 s, action 120 s, event 30 s, cleanup 5 s, load 120 s. Timeouts are
recorded by the existing per-extension error boundaries. A failed event does not
prevent later event handlers; a failed cleanup does not block the next extension.

An AsyncLocalStorage scope follows each operation. Calls through the provided
extension API are guarded at invocation time, including destructured methods and
registration disposers. A timed-out continuation cannot subsequently call that
API to mutate storage or register UI. Successful detached callbacks remain valid.

**Limitations:** this is not a sandbox or full hot-unload. A deadline cannot
preempt a synchronous infinite JS loop, undo raw filesystem/process effects, or
cancel a host request already started by an extension. Arbitrary external timers
and third-party side effects still require extension-owned cleanup. The global
queue still serializes healthy handlers; this change bounds waits rather than
redesigning the runtime or isolating each extension in a worker.

## R08 — bounded Android bridge event queues

Each request buffers at most 1,024 events. FIFO order is preserved while capacity
is available. The stdout reader uses non-blocking trySend: suspending that reader
could deadlock a handler waiting for another response on the same bridge.

Overflow is an explicit `event_queue_overflow` failure, not silent DROP_OLDEST or
conflation of tool results. The failed request clears its local queue and cancels
its event consumer. For cancellable turns it sends an abort targeted only at that
request ID; subscription overflow sends unsubscribe. Cleanup cannot start a new
Node process or target a different process generation. The original failure is
retained if remote cleanup also fails.

This bounds event **count**, not the byte size of a single frame. Normal burst
size and device memory behaviour still require on-device stress testing.

## R11 — deletion and reload are separate, observable outcomes

Both bridge bundles now return the same additive fields:

- `removed` and `removed_from_disk`: package deletion outcome;
- `reload_status`: `not_found`, `applied`, `deferred`, `partial`, or `failed`;
- `reload_required`: further user/agent recovery is needed;
- `effective_on_next_turn`: a busy session has a scheduled reload;
- `reload`: detailed per-session and Aether runtime outcomes.

The main bridge coordinates reload. Android's package manager no longer reloads
again after deletion, while the Android agent preserves the structured result.
The existing shared direct bridge consumer receives that same result. The UI
keeps its Result<Unit> wrapper. Imported-directory deletion retains its own path.

A successful disk deletion is not hidden by a later reload exception. A busy
session is not killed halfway through a tool call: its existing safe deferred
reload/recreation boundary is retained. No guessed `active:false` or promise of
immediate module unloading is returned.

## Regression evidence

The initial boundary run on GitHub (35076165051) produced six expected failures
and one pass. It reproduced hanging render/action/event/cleanup operations and
missing removal state in both bundles; successful detached callbacks passed.
After R06/R11 integration the same seven tests passed (35076578645).

The Android queue reproduction (35076769260) compiled successfully, then failed
`slowConsumerCannotAccumulateUnboundedEvents`; its FIFO test passed. The final
suite retains these cases and distinguishes overflow from a closed queue.

Permanent tests also cover reload failure after deletion, partial Aether reload,
absent packages, and a real busy Pi session against a local HTTP model fixture.
No paid model API, real OAuth server or user's filesystem is used by those tests.

Final CI status must be read from the pull request checks; this document is not a
claim that the current APK was tested on a physical phone.

## Rollback

Revert this change as one unit: kernel reload ownership and the Android consumer
must roll back together, otherwise duplicate or missing reloads would return.
No persisted-data migration or signing change needs reversal.
