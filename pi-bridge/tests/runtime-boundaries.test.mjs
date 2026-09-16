import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

async function fixture(t, code, { managed = false, bundle = 'bridge.mjs' } = {}) {
  const home = await mkdtemp(join(tmpdir(), 'ruru-boundary-'));
  const agent = join(home, '.pi', 'agent');
  const root = managed ? join(agent, 'npm', 'node_modules', 'boundary-test') : join(home, '.aether', 'extensions', 'boundary-test');
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'boundary-test', version: '1.0.0', aether: { api: { min: 2, max: 2 }, extensions: ['./aether.js'] } }));
  await writeFile(join(root, 'aether.js'), code);
  if (managed) await writeFile(join(agent, 'settings.json'), JSON.stringify({ packages: ['npm:boundary-test'] }));
  const child = spawn(process.execPath, [resolve('dist', bundle)], {
    cwd: home,
    env: { ...process.env, HOME: home, USERPROFILE: home, PI_CODING_AGENT_DIR: agent, PI_OFFLINE: '1', NODE_ENV: 'test', RURU_EXTENSION_TEST_TIMEOUT_MS: '60' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let next = 0;
  let stderr = '';
  const pending = new Map();
  const lines = createInterface({ input: child.stdout });
  child.stderr.on('data', part => { stderr = (stderr + part).slice(-12000); });
  lines.on('line', line => {
    let frame;
    try { frame = JSON.parse(line); } catch { return; }
    if (frame.type === 'event') return;
    const waiter = pending.get(frame.id);
    if (!waiter) return;
    pending.delete(frame.id);
    clearTimeout(waiter.timer);
    if (frame.type === 'error' || frame.ok === false) waiter.reject(new Error(frame.error?.message ?? 'bridge error'));
    else waiter.resolve(frame.payload);
  });
  t.after(async () => {
    for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('fixture closed')); }
    pending.clear();
    lines.close();
    const closed = new Promise(resolve => child.once('close', resolve));
    child.kill('SIGKILL');
    await closed;
    await rm(home, { recursive: true, force: true });
  });
  const request = (type, payload = {}) => new Promise((resolve, reject) => {
    const id = `boundary-${++next}`;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`HARNESS timeout: ${type}; ${stderr}`)); }, 2500);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ id, type, payload }) + '\n');
  });
  return { request, root };
}

const baseCode = `export default api => {
  api.registerAction('healthy', () => ({ healthy: true }));
  api.registerAction('read', () => ({ late: api.storage.get('late', false) }));
  api.registerSurface('app.test', { id: 'test', render: context => context.hang ? new Promise(() => {}) : { type: 'text', text: 'Healthy' } });
};`;

test('R06: an unresolved renderer reports a timeout and releases the UI queue', async t => {
  const { request } = await fixture(t, baseCode);
  const loaded = await request('reload_aether_extensions');
  const id = loaded.snapshot.extensions[0].id;
  const stalled = await request('get_aether_extensions', { context: { hang: true } });
  assert.match(JSON.stringify(stalled.snapshot.errors), /timed out/i);
  const healthy = await request('invoke_aether_extension_action', { extension_id: id, action: 'healthy' });
  assert.equal(healthy.result.healthy, true);
});

test('R06: timed-out action cannot write late data through captured API methods', async t => {
  const { request } = await fixture(t, `export default api => {
    const set = api.storage.set;
    api.registerAction('late', async () => { await new Promise(r => setTimeout(r, 250)); set('late', true); });
    api.registerAction('read', () => ({ late: api.storage.get('late', false) }));
  };`);
  const loaded = await request('reload_aether_extensions');
  const id = loaded.snapshot.extensions[0].id;
  await assert.rejects(request('invoke_aether_extension_action', { extension_id: id, action: 'late' }), /timed out/i);
  await delay(320);
  const read = await request('invoke_aether_extension_action', { extension_id: id, action: 'read' });
  assert.equal(read.result.late, false);
});

test('R06: hanging event does not starve subsequent healthy event handlers', async t => {
  const { request } = await fixture(t, `export default api => {
    api.on('probe', () => new Promise(() => {}));
    api.on('probe', () => ({ payload: { healthy: true } }));
  };`);
  await request('reload_aether_extensions');
  const result = await request('dispatch_aether_extension_event', { event: 'probe' });
  assert.equal(result.payload.healthy, true);
  assert.match(JSON.stringify(result.snapshot.errors), /timed out/i);
});

test('R06: hanging cleanup is diagnosed without blocking the replacement runtime', async t => {
  const { request } = await fixture(t, `export default api => {
    api.registerAction('healthy', () => ({ healthy: true }));
    return () => new Promise(() => {});
  };`);
  await request('reload_aether_extensions');
  const loaded = await request('reload_aether_extensions');
  assert.equal(loaded.reloaded, true);
  assert.match(JSON.stringify(loaded.errors), /timed out/i);
  const result = await request('invoke_aether_extension_action', { extension_id: loaded.snapshot.extensions[0].id, action: 'healthy' });
  assert.equal(result.result.healthy, true);
});

test('R06: successful detached callbacks remain supported', async t => {
  const { request } = await fixture(t, `export default api => {
    api.registerAction('schedule', () => { setTimeout(() => api.storage.set('late', true), 100); return { scheduled: true }; });
    api.registerAction('read', () => ({ late: api.storage.get('late', false) }));
  };`);
  const loaded = await request('reload_aether_extensions');
  const id = loaded.snapshot.extensions[0].id;
  await request('invoke_aether_extension_action', { extension_id: id, action: 'schedule' });
  await delay(170);
  const read = await request('invoke_aether_extension_action', { extension_id: id, action: 'read' });
  assert.equal(read.result.late, true);
});

for (const bundle of ['bridge.mjs', 'extension-bridge.mjs']) {
  test(`R11: ${bundle} removes installed UI code once and returns explicit reload state`, async t => {
    const { request } = await fixture(t, baseCode, { managed: true, bundle });
    const loaded = await request('reload_aether_extensions');
    assert.equal(loaded.snapshot.extensions.length, 1);
    const removed = await request('remove_extension_package', { source: 'npm:boundary-test' });
    assert.equal(removed.removed, true);
    assert.equal(removed.removed_from_disk, true);
    assert.equal(removed.reload_status, 'applied');
    assert.equal(removed.effective_on_next_turn, false);
    assert.equal(removed.reload.succeeded, true);
    assert.deepEqual(removed.packages, []);
    const after = await request('get_aether_extensions');
    assert.equal(after.snapshot.extensions.length, 0);
  });
}
