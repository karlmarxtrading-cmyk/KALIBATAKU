import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {performance} from 'node:perf_hooks';
import {createHash,webcrypto} from 'node:crypto';
import {createAttempt,begin,editDraft} from '../../src/player/engine.mjs';
import * as store from '../../src/data/store.js';
import {exportRecoveryBackup,previewBackup,importBackup,readBackup} from '../../src/data/backup.js';
import {deliverySummary} from '../../src/data/sync.js';
import {transaction,row} from '../../src/data/db.js';
import {downloadPlan} from '../../src/data/offline.js';

const pkg=JSON.parse(await readFile(new URL('../../spec/examples/PACKAGE_CONTRACT_EXAMPLE.json',import.meta.url)));
const reports=[];
async function test(name,check){
  try{reports.push({name,status:'PASS',observations:await check()});}
  catch(error){reports.push({name,status:'FAIL',error:error.stack});process.exitCode=1;}
}
const create=async name=>store.scopeForLocal((await store.createProfile(name)).id);
const A=await create('Demo A'),B=await create('Demo B');
const active=store.selectScope(B);
const fixture=createAttempt(pkg,A,{lang:'id',mode:'practice'});await store.saveAttempt(fixture,begin(fixture),A);
await test('Pending draft rescue validates and restores the original owner with the exact event ledger',async()=>{
  editDraft(fixture,0,'2/','id');
  const rescue=await exportRecoveryBackup(A,fixture),before=await store.listEvents(fixture.attempt_id,A);
  const preview=await previewBackup(rescue);assert.equal(preview.profile_id,A.profileId);assert.equal(preview.sessions,1);
  assert(preview.recovery_draft&&preview.first_date===fixture.started_at&&preview.additions===1&&preview.conflicts.length===0);
  assert.equal((await store.getAttempt(fixture.attempt_id,A)).items[0].draft,'');
  await importBackup(rescue);
  const recovered=await store.getAttempt(fixture.attempt_id,A);
  assert.equal(recovered.items[0].draft,'2/');assert(recovered.items[0].dirty);
  assert.equal((await importBackup(rescue)).additions,0);
  assert.deepEqual(await store.listEvents(fixture.attempt_id,A),before);assert.deepEqual(store.activeScope(),active);
  assert.equal(await store.getAttempt(fixture.attempt_id,B),null);
  await store.deleteProfile(A.profileId);await importBackup(rescue);
  assert.equal((await store.getAttempt(fixture.attempt_id,A)).items[0].draft,'2/');assert.deepEqual(await store.listEvents(fixture.attempt_id,A),before);
  return {format:rescue.format,version:rescue.schema_version,draft:'2/',events:before.length,preview_writes:0,duplicate_additions:0,other_profile_modified:false};
});
await test('Raw session and report JSON rejected with actionable distinct types',async()=>{
  await assert.rejects(()=>readBackup(fixture),/SESSION_COPY/);
  await assert.rejects(()=>readBackup({schema_version:'parents-report-1.0'}),/REPORT_FILE/);
  return {session:'SESSION_COPY',parent_report:'REPORT_FILE'};
});
await test('Index migration, filtered paging, isolated delete and concurrent change guard across 5000 sessions',async()=>{
  const ns=store.scopeKey(B),count=5000;
  await transaction(['attempts'],true,async tx=>{
    for(let n=0;n<count;n++){
      const id='legacy-'+n,started_at=new Date(Date.UTC(2026,0,1)+n*1000).toISOString();
      await tx.put('attempts',row(ns,id,{...fixture,profile_id:B.profileId,attempt_id:id,started_at,status:n%3?'completed':'ongoing',grade:n%2+1}));
    }
  });
  const t0=performance.now(),first=await store.queryAttemptSummaries(B,{limit:10});
  const t1=performance.now(),page=await store.queryAttemptSummaries(B,{grade:2,status:'completed',limit:10,offset:20});
  const t2=performance.now(),latest=await store.queryAttemptSummaries(B,{limit:1});
  const since=new Date(Date.UTC(2026,0,1)+(count-6)*1000).toISOString();
  const recent=await store.queryAttemptSummaries(B,{since,grade:2,limit:10});assert.deepEqual(recent.rows.map(r=>r.attempt_id),['legacy-4999','legacy-4997','legacy-4995']);
  assert.equal(recent.total,3);assert.equal((await store.queryAttemptSummaries(B,{since})).total,6);
  assert.equal(first.total,count);assert.equal(first.rows.length,10);assert.equal(latest.rows[0].attempt_id,'legacy-4999');
  assert.equal(page.rows.length,10);assert.equal(page.total,Array.from({length:count},(_,n)=>n%2===1&&n%3>0).filter(Boolean).length);
  assert(page.rows.every(s=>s.grade===2&&s.status==='completed'&&!('items' in s)));assert.equal(first.rows[0].item_count,fixture.items.length);
  assert.deepEqual([...(await store.usedPackages(B))],[fixture.package_id]);
  const before=await store.profileImpact(B.profileId);await store.addRecord('policy','test',{count:1},B);
  await assert.rejects(()=>store.deleteProfile(B.profileId,before),/PROFILE_CHANGED/);
  assert.equal((await store.profileImpact(B.profileId)).sessions,count);
  await store.deleteProfile(B.profileId,await store.profileImpact(B.profileId));
  assert.equal((await store.queryAttemptSummaries(B)).total,0);assert.equal((await store.queryAttemptSummaries(A)).total,1);
  return {backend:'temporary memory, Node',synthetic_sessions:count,backfill_ms:+(t1-t0).toFixed(2),filtered_page_ms:+(t2-t1).toFixed(2),page_size:page.rows.length,page_bytes:new TextEncoder().encode(JSON.stringify(page)).length,fields:Object.keys(page.rows[0]),tagged_as_device_performance:false};
});
await test('First start moves chrono index without duplicating a preflight attempt',async()=>{
  const C=await create('Demo C'),a=createAttempt(pkg,C,{lang:'id',mode:'practice',now:1000});
  await store.saveAttempt(a,null,C);await store.queryAttemptSummaries(C);
  await store.saveAttempt(a,begin(a,2000),C);
  const p=await store.queryAttemptSummaries(C);assert.equal(p.total,1);assert.equal(p.rows[0].started_at,new Date(2000).toISOString());assert.equal(p.rows[0].last_saved_at,a._saved_at);
  assert.deepEqual([...(await store.usedPackages(C,{status:'ongoing'}))],[a.package_id]);
  assert.equal((await store.usedPackages(C,{status:'completed'})).size,0);
  return {rows:1,changed_start_time:true};
});
await test('Transfer plan counts remaining shell, selected shard and pack once',async()=>{
  const m={release:'123456789abcdef0',assets:[{path:'app.mjs',bytes:150},{path:'bank/index.json',bytes:20}],catalogs:{'bank/g01/l01.json':{bytes:81}}};
  const info={id:'test',bytes:239,dependencies:['bank/index.json','bank/g01/l01.json'],url:'bank/v1.2/g01/l01/test.mjs'};
  const p=await downloadPlan(info,m);assert.equal(p.bytes,490);
  const root=new URL('../../src/app.mjs',import.meta.url).href;
  globalThis.caches={has:async()=>true,open:async()=>({match:async path=>path===root})};
  const warm=await downloadPlan(info,m);assert.equal(warm.bytes,340);assert.equal(warm.shared,150);delete globalThis.caches;
  return {decoded_cold_bytes:p.bytes,decoded_warm_bytes:warm.bytes,already_cached:150};
});
await test('Session delivery tracks last correlated ACK, queued events, denied access and scoped retry time separately',async()=>{
  const rows=[{attempt_id:'a',state:'mock_accepted',received_at:'2026-11-25T01:00:00Z'},{attempt_id:'a',state:'pending_sync'},
    {attempt_id:'b',state:'rejected',http_status:403},{attempt_id:'c',state:'retry_required',next_at:200},{attempt_id:'c',state:'retry_required',next_at:110}];
  const groups=deliverySummary(rows);assert.equal(groups.get('a').last_ack,rows[0].received_at);assert.equal(groups.get('a').accepted,1);assert(groups.get('b').forbidden);assert.equal(groups.get('c').next_at,110);
  return {sessions:groups.size,first_session_received:'1/2',forbidden:true,grading_escalated:false};
});
await test('Service worker excludes incomplete pack caches and falls back only to a complete shell revision during interruption',async()=>{
  const base='https://school.invalid/nested/',prefix='kalibataku:/nested/:',release='b'.repeat(16);
  const shell=prefix+'shell:'+release,old=prefix+'shell:'+('a'.repeat(16)),pack=prefix+'ready-pack:'+release+':test';
  const marker=(release,body)=>JSON.stringify({release,assets:[{path:'app.mjs',bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')}]});
  const previous='old complete',current='new complete';
  const cached=new Map([[shell,new Map([[base+'app.mjs',current]])],[old,new Map([[base+'offline-assets.json',marker('a'.repeat(16),previous)],[base+'app.mjs',previous]])],
    [pack,new Map([[base+'bank/v1.2/test.mjs','verified math']])]]);
  const listeners={};
  const script=(await readFile(new URL('../../src/sw.js',import.meta.url),'utf8')).replace('__KALIBATAKU_BUILD__',release);
  const policy=await readFile(new URL('../../src/cache-policy.js',import.meta.url),'utf8');
  const sandbox={importScripts:name=>{if(name!=='cache-policy.js')throw Error('unexpected import '+name);runInNewContext(policy,sandbox);},
    self:{registration:{scope:base},addEventListener:(k,f)=>{listeners[k]=f;}},URL,Response,crypto:webcrypto,
    caches:{keys:async()=>[...cached.keys()],match:async(k,{cacheName})=>{
      const v=cached.get(cacheName)?.get(String(k));return v===undefined?null:new Response(v);
    }},fetch:async()=>new Response('outage',{status:503})};
  sandbox.globalThis=sandbox;runInNewContext(script,sandbox);
  const request=async path=>{
    let result;
    listeners.fetch({request:new Request(base+path),respondWith:r=>{result=r;}});
    return result;
  };
  assert.equal(await (await request('app.mjs')).text(),previous);
  // Both bodies exist but neither shell has a completion marker: neither may be used.
  cached.get(old).delete(base+'offline-assets.json');
  assert.equal((await request('app.mjs')).status,503);
  cached.get(old).set(base+'offline-assets.json',marker('a'.repeat(16),previous));
  assert.equal((await request('bank/v1.2/test.mjs')).status,503);
  cached.get(pack).set(base+'__pack_ready__',release);
  assert.equal(await (await request('bank/v1.2/test.mjs')).text(),'verified math');
  cached.get(shell).set(base+'offline-assets.json',marker(release,current));
  assert.equal(await (await request('app.mjs')).text(),current);
  // A committed current release cannot mix a corrupted file with an older
  // module when disconnected. Same length tests the digest as well as size.
  cached.get(shell).set(base+'app.mjs',current.toUpperCase());
  const damaged=await request('app.mjs');
  assert.equal(damaged.status,503);
  assert.match(await damaged.text(),/Reconnect/);
  cached.get(shell).set(base+'app.mjs',current);
  assert.equal(await (await request('app.mjs')).text(),current);
  assert.equal((await request('teacher/export/pdf.js')).status,503);
  return {runtime:'Node VM with Cache Storage and HTTP 503 fixtures',uncommitted_pack_served:false,
    shell_during_interruption:'previous completed revision',uncommitted_prior_shell_http:503,verified_current:true,corrupt_current_http:503,verified_pack_served:true,uncached_teacher_http:503};
});
await mkdir('evidence/ux/data',{recursive:true});
await writeFile('evidence/ux/data/component.json',JSON.stringify({environment:process.version,results:reports},null,2)+'\n');
console.log(reports.map(r=>r.name+' '+r.status+(r.error?' '+r.error:'')).join('\n'));
