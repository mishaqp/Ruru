import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJiti } from 'jiti';
const { finishExtensionRemoval } = await createJiti(import.meta.url).import('../src/extension-removal.ts');

test('removal preserves the disk result when reload throws', async () => {
  const result = await finishExtensionRemoval(true, async () => { throw new Error('reload broke'); });
  assert.equal(result.removed_from_disk, true);
  assert.equal(result.reload_status, 'failed');
  assert.equal(result.reload_required, true);
  assert.equal(result.reload.error, 'reload broke');
});

test('busy sessions report deferred reload, never immediate unload', async () => {
  let calls = 0;
  const result = await finishExtensionRemoval(true, async () => {
    calls++;
    return { succeeded: true, sessions: [{ session_id: 'busy', scheduled: true, reloaded: false }], aether_reload: { reloaded: true, errors: [] } };
  });
  assert.equal(calls, 1);
  assert.equal(result.reload_status, 'deferred');
  assert.equal(result.effective_on_next_turn, true);
  assert.equal(result.reload_required, false);
  assert.equal(Object.hasOwn(result, 'active'), false);
});

test('a UI reload failure is visible even if Pi reload succeeded', async () => {
  const result = await finishExtensionRemoval(true, async () => ({ succeeded: true, sessions: [], aether_reload: { reloaded: false, errors: [{ error: 'bad factory' }] } }));
  assert.equal(result.reload_status, 'partial');
  assert.equal(result.reload_required, true);
});

test('an absent package does not trigger an unnecessary reload', async () => {
  let called = false;
  const result = await finishExtensionRemoval(false, async () => { called = true; return {}; });
  assert.equal(called, false);
  assert.equal(result.reload_status, 'not_found');
  assert.equal(result.removed, false);
});
