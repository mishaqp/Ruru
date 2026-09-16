import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

async function fixture(source, use) {
  const home = await mkdtemp(join(tmpdir(), 'ruru-deadline-'));
  const root = join(home, '.aether', 'extensions');
  for (const [name, code] of Object.entries({
    healthy: `export default a => { a.registerSettings({id:'healthy',title:'Healthy',sections:[]}); a.registerAction('ping', () => ({alive:true})); a.on('probe',()=>({healthyEvent:true})); };`,
    broken: source,
  })) {
    await mkdir(join(root, name), {recursive:true});
    await writeFile(join(root, name, 'package.json'), JSON.stringify({name, aether:{api:2, extensions:['./aether.ts']}}));
    await writeFile(join(root, name, 'aether.ts'), code);
  }
  const child = spawn(process.execPath, [resolve('dist/extension-bridge.mjs')], {
    cwd: home,
    env:{...process.env, HOME:home, USERPROFILE:home, PI_CODING_AGENT_DIR:join(home,'.pi','agent'),
      RURU_EXTENSION_LOAD_TIMEOUT_MS:'1000', RURU_EXTENSION_RENDER_TIMEOUT_MS:'80',
      RURU_EXTENSION_ACTION_TIMEOUT_MS:'80', RURU_EXTENSION_EVENT_TIMEOUT_MS:'80', RURU_EXTENSION_CLEANUP_TIMEOUT_MS:'80'},
    stdio:['pipe','pipe','pipe'],
  });
  const closed = new Promise(r => child.once('close',r));
  const pending = new Map();
  let sequence=0, stderr='';
  child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-10000);});
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{
    let frame; try {frame=JSON.parse(line);} catch {return;}
    if(frame.type==='event') return;
    const waiter=pending.get(frame.id); if(!waiter) return;
    pending.delete(frame.id); clearTimeout(waiter.timer);
    if(frame.type==='error'||frame.ok===false) waiter.reject(new Error(frame.error?.message??JSON.stringify(frame.error)));
    else waiter.resolve(frame.payload);
  });
  const request=(type,payload={})=>new Promise((resolve,reject)=>{
    const id=`deadline-${++sequence}`;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`OUTER DEADLINE: runtime queue did not recover; ${stderr}`));},2000);
    pending.set(id,{resolve,reject,timer});
    child.stdin.write(JSON.stringify({id,type,payload})+'\n');
  });
  try {await use({request,home,root});} finally {
    for(const p of pending.values()) clearTimeout(p.timer);
    lines.close(); child.kill('SIGKILL'); await closed;
    await rm(home,{recursive:true,force:true});
  }
}
async function healthyResponds(request,snapshot) {
  const healthy=snapshot.extensions.find(e=>e.name==='healthy');
  assert.ok(healthy,'healthy extension disappeared');
  const result=await request('invoke_aether_extension_action',{extension_id:healthy.id,action:'ping'});
  assert.equal(result.result.alive,true);
}

test('R06: hanging render releases the runtime queue', {timeout:10000}, async()=>{
  await fixture(`export default a=>{a.registerSurface('app.top',{id:'hang',render:()=>new Promise(()=>{})});};`,async({request})=>{
    const result=await request('reload_aether_extensions');
    assert.ok(result.snapshot.errors.some(e=>/timed out/i.test(e.error)),'missing render timeout diagnostic');
    await healthyResponds(request,result.snapshot);
  });
});

test('R06: timed-out action cannot write late settings or storage', {timeout:10000}, async()=>{
  await fixture(`export default a=>{a.registerAction('slow',async()=>{await new Promise(r=>setTimeout(r,400));a.storage.set('late',true);a.registerSettings({id:'late',title:'Late pollution',sections:[]});return {late:true};});};`,async({request,home})=>{
    const first=await request('reload_aether_extensions');
    const ext=first.snapshot.extensions.find(e=>e.name==='broken');
    await assert.rejects(request('invoke_aether_extension_action',{extension_id:ext.id,action:'slow'}),/timed out/i);
    await new Promise(r=>setTimeout(r,500));
    const next=await request('get_aether_extensions');
    assert.equal(next.snapshot.settings.some(s=>s.title==='Late pollution'),false);
    const storage=JSON.parse(await readFile(join(home,'.aether','app-extension-state.json'),'utf8'));
    assert.notEqual(storage[ext.id]?.late,true,'late callback mutated persistent storage');
    await healthyResponds(request,next.snapshot);
  });
});

test('R06: hanging cleanup cannot block removal of UI extension', {timeout:10000}, async()=>{
  await fixture(`export default a=>{a.registerSettings({id:'old',title:'Old',sections:[]});return ()=>new Promise(()=>{});};`,async({request,root})=>{
    await request('reload_aether_extensions');
    const result=await request('reload_aether_extensions',{disabled_extension_paths:[join(root,'broken')],disabled_package_sources:[]});
    assert.equal(result.snapshot.extensions.some(e=>e.name==='broken'),false);
    assert.ok(result.errors.some(e=>/timed out/i.test(e.error)),'missing cleanup timeout diagnostic');
    await healthyResponds(request,result.snapshot);
  });
});

test('R06: hanging factory cannot block healthy extension loading', {timeout:10000}, async()=>{
  await fixture(`export default async a=>{a.registerSettings({id:'partial',title:'Partial',sections:[]});await new Promise(()=>{});};`,async({request})=>{
    const result=await request('reload_aether_extensions');
    assert.ok(result.errors.some(e=>/timed out/i.test(e.error)),'missing factory timeout diagnostic');
    assert.equal(result.snapshot.settings.some(s=>s.title==='Partial'),false);
    await healthyResponds(request,result.snapshot);
  });
});

test('R06: hanging event does not prevent the next extension handler', {timeout:10000}, async()=>{
  await fixture(`export default a=>{a.on('probe',()=>new Promise(()=>{}));};`,async({request})=>{
    const first=await request('reload_aether_extensions');
    const result=await request('dispatch_aether_extension_event',{event:'probe'});
    assert.ok(result.snapshot.errors.some(e=>/timed out/i.test(e.error)),'missing event timeout diagnostic');
    assert.equal(result.payload.healthyEvent,true,'later event handler was not executed');
    await healthyResponds(request,first.snapshot);
  });
});
