import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { test } from 'node:test';

test('package removal defers a busy Pi session and removes its commands on next use', { timeout: 30_000 }, async t => {
  const home = await mkdtemp(join(tmpdir(), 'ruru-remove-busy-'));
  const agent = join(home, '.pi', 'agent');
  const root = join(agent, 'npm', 'node_modules', 'ruru-busy-fixture');
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'ruru-busy-fixture', version: '1.0.0', pi: { extensions: ['./index.js'] } }));
  await writeFile(join(root, 'index.js'), `export default pi => { pi.registerCommand('busy_probe', { description: 'fixture', handler: async () => {} }); };`);
  await writeFile(join(agent, 'settings.json'), JSON.stringify({ packages: ['npm:ruru-busy-fixture'] }));

  let heldResponse;
  let markArrived;
  const arrived = new Promise(resolve => { markArrived = resolve; });
  const send = response => {
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    for (const choices of [
      [{ index: 0, delta: { role: 'assistant', content: 'OK' }, finish_reason: null }],
      [{ index: 0, delta: {}, finish_reason: 'stop' }],
    ]) response.write('data: ' + JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 0, model: 'fixture', choices }) + '\n\n');
    response.end('data: [DONE]\n\n');
  };
  let callCount = 0;
  const server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      if (++callCount === 1) { heldResponse = res; markArrived(); }
      else send(res);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const child = spawn(process.execPath, [resolve('dist/bridge.mjs')], {
    cwd: home,
    env: { ...process.env, HOME: home, USERPROFILE: home, PI_CODING_AGENT_DIR: agent, PI_OFFLINE: '1' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const pending = new Map();
  let sequence = 0;
  let stderr = '';
  child.stderr.on('data', data => { stderr = (stderr + data).slice(-12000); });
  const reader = createInterface({ input: child.stdout });
  reader.on('line', line => {
    let frame;
    try { frame = JSON.parse(line); } catch { return; }
    if (frame.type === 'event') return;
    const waiter = pending.get(frame.id);
    if (!waiter) return;
    pending.delete(frame.id);
    clearTimeout(waiter.timer);
    if (frame.type === 'error' || frame.ok === false) waiter.reject(new Error(JSON.stringify(frame.error)));
    else waiter.resolve(frame.payload);
  });
  const request = (type, payload = {}) => new Promise((resolve, reject) => {
    const id = `busy-${++sequence}`;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${type} timeout: ${stderr}`)); }, 10_000);
    pending.set(id, { timer, resolve, reject });
    child.stdin.write(JSON.stringify({ id, type, payload }) + '\n');
  });
  t.after(async () => {
    for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('test closed')); }
    pending.clear();
    reader.close();
    const closed = new Promise(resolve => child.once('close', resolve));
    child.kill('SIGKILL');
    await closed;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(home, { recursive: true, force: true });
  });
  const turn = {
    session_id: 'remove-busy', platform: 'android', runtime: 'alpine',
    workspace_directory: home, workspace_trusted: true,
    model_config: { provider_type: 'openai_compatible', provider_config_id: 'busy-fixture', pi_provider_id: 'busy-fixture', pi_api: 'openai-completions', model_id: 'fixture', base_url: `http://127.0.0.1:${server.address().port}/v1`, api_key: 'local-fixture', reasoning: false, max_retries: 0 },
    system_prompt: 'Return OK.', messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }], host_tools: [], reasoning: 'off',
  };
  const first = request('run_turn', turn);
  first.catch(() => {});
  await Promise.race([arrived, first.then(() => { throw new Error('turn finished before fixture release'); })]);
  const before = await request('list_extensions', { session_id: turn.session_id });
  assert.ok(before.extension_paths.some(path => path.startsWith(root + '/')), JSON.stringify(before));
  const removal = await request('remove_extension_package', { source: 'npm:ruru-busy-fixture' });
  assert.equal(removal.removed_from_disk, true);
  assert.equal(removal.reload_status, 'deferred');
  assert.equal(removal.effective_on_next_turn, true);
  assert.ok(removal.reload.sessions.some(session => session.session_id === turn.session_id && session.scheduled));
  send(heldResponse);
  const finished = await first;
  assert.equal(finished.assistant_text, 'OK', JSON.stringify(finished));
  await request('run_turn', turn);
  const after = await request('list_extensions', { session_id: turn.session_id });
  assert.ok(after.extension_paths.every(path => !path.startsWith(root + '/')), JSON.stringify(after));
  await assert.rejects(request('invoke_extension_command', { session_id: turn.session_id, command: 'busy_probe' }), /Unknown Pi extension command/);
});
