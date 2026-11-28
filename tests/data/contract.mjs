import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createAttempt,begin,editDraft,submit,finish} from '../../src/player/engine.mjs';
import * as store from '../../src/data/store.js';
import * as bridge from '../../src/data/bridge.js';
import {syncPending,listOutbox} from '../../src/data/sync.js';
import {transaction,key,row} from '../../src/data/db.js';
import {exportBackup,previewBackup,importBackup,readBackup} from '../../src/data/backup.js';
import {eventHash,canonical,scopeKey,sha256} from '../../src/data/common.js';
const pkg=JSON.parse(await readFile(new URL('../../spec/examples/PACKAGE_CONTRACT_EXAMPLE.json',import.meta.url),'utf8'));
const fixture=JSON.parse(await readFile(new URL('../../spec/examples/ANSWER_EVENT_EXAMPLE.json',import.meta.url),'utf8'));
const results=[];
async function run(id,description,fn){try{await fn();results.push({id,description,status:'PASS'});}catch(e){results.push({id,description,status:'FAIL',error:e.stack});console.error(description,e);}}
const demo={profileId:'contract-student',environment:'demo',origin:'demo'}, remote={profileId:'contract-student',environment:'lms-test',origin:'lms_client'};
const personal=await store.createProfile('Synthetic practice'),local=store.scopeForLocal(personal.id);
const attempts={};
async function newAttempt(scope,complete=true){
  const a=createAttempt(pkg,scope,{mode:'assessment',lang:'en'});await store.saveAttempt(a,begin(a),scope);
  editDraft(a,0,'96','en');await store.saveAttempt(a,submit(a,0),scope);
  if(complete)await store.saveAttempt(a,finish(a),scope);
  return a;
}
const bind=(a)=>({attempt_id:a.attempt_id,package_id:a.package_id,content_version:a.content_version,assignment_id:a.assignment_id,policy_version:a.policy_version});
const makeBatch=(events)=>({batch_id:crypto.randomUUID(),schema_version:'1.0.0',attempt_id:events[0].attempt_id,events});
const ack=(b,origin='server')=>({schema_version:'1.0.0',receipt_origin:origin,batch_id:b.batch_id,received_at:new Date().toISOString(),attempt_id:b.attempt_id,
  receipts:b.events.map(e=>({event_id:e.event_id,payload_hash:e.payload_hash,transport_result:'accepted',grading_state:'unverified',error_code:null})),missing_sequences:[]});
await run('TC-129','Commit with ledger/outbox, transaction abort rolls changes back in the temporary backend',async()=>{
  attempts.local=await newAttempt(local);attempts.demo=await newAttempt(demo);
  assert.equal((await listOutbox(local)).length,0);assert.equal((await listOutbox(demo)).length,3);
  const before=await store.listAttempts(local);
  await assert.rejects(()=>transaction(['attempts','events','outbox'],true,async t=>{await t.put('attempts',row(scopeKey(local),'partial',{partial:true}));throw Error('injected abort');}));
  assert.deepEqual(await store.listAttempts(local),before);
  assert.equal((await store.listEvents(attempts.demo.attempt_id,demo)).length,3);
});
await run('TC-130','Temporary storage labelled, exportable, final session resists edits',async()=>{
  assert.equal((await store.getStatus()).temporary,true);
  assert((await exportBackup(local)).checksum);await assert.rejects(()=>store.saveAttempt(attempts.local,null,local),/FINALIZED/);
});
await run('TC-131','Independent writer IDs, explicit takeover, stale revision rejection',async()=>{
  const other=await import('../../src/data/store.js?second-writer');
  const a=await newAttempt(local,false),stale=structuredClone(a);
  await assert.rejects(()=>other.acquireAttempt(a.attempt_id,local),/LOCKED/);
  await other.acquireAttempt(a.attempt_id,local,{takeover:true});await other.saveAttempt(a,null,local);
  await assert.rejects(()=>store.saveAttempt(stale,null,local),/STALE_REVISION/);await other.releaseAttempt(a.attempt_id,local);
});
await run('TC-133','Verified backup round trip, no duplicate records; mismatch/conflict roll back',async()=>{
  const b=await exportBackup(local),before=await store.listEvents(null,local);
  const p=await previewBackup(b);assert.equal(p.additions,0);assert.equal(p.conflicts.length,0);
  const corrupt=structuredClone(b);corrupt.profile.name='altered';
  await assert.rejects(()=>readBackup(corrupt),/CHECKSUM_MISMATCH/);
  delete corrupt.checksum;corrupt.checksum=await sha256(canonical(corrupt,false));const c=await previewBackup(corrupt);assert.equal(c.conflicts.length,1);
  await assert.rejects(()=>importBackup(corrupt),/IMPORT_CONFLICT/);
  await store.deleteProfile(personal.id);await importBackup(b);assert.deepEqual(await store.listEvents(null,local),before);
  assert.equal((await importBackup(b)).additions,0);
});
await run('TC-134','Profile isolation and removal including dependent data',async()=>{
  const second=await store.createProfile('other'),scope=store.scopeForLocal(second.id);
  await newAttempt(scope);assert.equal((await store.listAttempts(scope)).length,1);
  const count=(await store.listAttempts(local)).length;await store.deleteProfile(second.id);
  assert.equal((await store.listAttempts(scope)).length,0);assert.equal((await store.listAttempts(local)).length,count);
});
await run('TC-135','Remote missing config makes no request, no mocked receipt',async()=>{
  let called=false;const api=new bridge.RemoteApiAdapter(remote,{fetcher:()=>{called=true;}});
  await assert.rejects(()=>api.getCapabilities(),/BRIDGE_NOT_CONFIGURED/);assert.equal(called,false);
});
await run('TC-136','Partial, duplicate and malformed mock receipts; canonical cross-language hash fixture',async()=>{
  assert.equal(await eventHash(fixture),fixture.payload_hash);
  const a=attempts.demo,events=await store.listEvents(a.attempt_id,demo),m=new bridge.MockAdapter(demo,{partial:1});
  await m.startAttempt(bind(a));const b=makeBatch(events);const r=await m.sendEventBatch(b);
  assert.equal(bridge.correlate(b,r,'mock').size,1);assert.equal(r.receipts[0].grading_state,'unverified');assert.equal(r.receipt_origin,'mock');
  r.receipts[0].grading_state='verified';assert.throws(()=>bridge.correlate(b,r,'mock'),/MALFORMED_ACK/);
});
await run('TC-137','Retry after commit uses identical IDs/hashes, duplicate once; collision detected',async()=>{
  const a=await newAttempt(demo),m=new bridge.MockAdapter(demo,{timeoutAfterCommit:true});await m.startAttempt(bind(a));
  const b=makeBatch(await store.listEvents(a.attempt_id,demo));await assert.rejects(()=>m.sendEventBatch(b),/TIMEOUT_AFTER_COMMIT/);
  const retry=await m.sendEventBatch(b);assert(retry.receipts.every(e=>e.transport_result==='duplicate'));
  const changed=structuredClone(b.events[1]);changed.payload.raw_answer='096';changed.payload_hash=await eventHash(changed);
  assert.equal((await m.sendEventBatch(makeBatch([changed]))).receipts[0].transport_result,'conflict');
  const clash={...b.events[0],event_id:crypto.randomUUID()};clash.payload_hash=await eventHash(clash);
  assert.equal((await m.sendEventBatch(makeBatch([clash]))).receipts[0].error_code,'SEQUENCE_CONFLICT');
});
function makeRemote(opts={}) {
  const seen=opts.seen||[];
  const config={apiBaseUrl:'https://school.invalid/api/v1',environment_id:remote.environment,testOrigin:'https://school.invalid',csrfToken:'synthetic-in-memory',
    fetcher: async(url,req)=>{
      seen.push([url,req]);const path=new URL(url).pathname.replace('/api/v1','');
      if(path==='/capabilities')return Response.json({schema_versions:opts.schemas||['1.0.0'],environment_id:remote.environment,max_events:100,max_bytes:262144});
      if(path==='/me')return Response.json({subject:opts.subject||remote.profileId,environment_id:remote.environment});
      if(path==='/events/batch'){
        if(opts.status)return Response.json({error:{code:'HTTP_'+opts.status}},{status:opts.status,headers:{'Retry-After':'12'}});
        const b=JSON.parse(req.body),r=ack(b);return Response.json(opts.ack?opts.ack(r,b):r);
      }
      if(path==='/attempts/complete')return Response.json({status:'complete',grading_state:'queued'});
      return Response.json({ok:true});
    }};
  return new bridge.RemoteApiAdapter(remote,config);
}
async function clearRemote(){await transaction(['outbox'],true,async t=>{for(const r of await t.all('outbox',scopeKey(remote)))await t.del('outbox',r.key);});}
const doRemote=adapter=>syncPending(remote,{adapter,getCurrentScope:()=>remote,maxBatches:1});
await run('TC-138','Partial ACK changes only correlated events; malformed attempt/hash keeps ledger and outbox',async()=>{
  await clearRemote();await newAttempt(remote);
  let api=makeRemote({ack:r=>({...r,receipts:r.receipts.slice(0,1)})});await doRemote(api);
  let q=await listOutbox(remote);assert.equal(q.filter(e=>e.state==='server_accepted').length,1);assert.equal(q.filter(e=>e.state==='pending_sync').length,2);
  api=makeRemote({ack:r=>({...r,attempt_id:'bad'})});await doRemote(api);
  q=await listOutbox(remote);assert.equal(q.filter(e=>e.state==='retry_required').length,2);
  const b=makeBatch(await store.listEvents(q[0].attempt_id,remote)), wrong=ack(b);wrong.receipts[0].payload_hash='0'.repeat(64);
  assert.throws(()=>bridge.correlate(b,wrong,'server'),/MISMATCHED_ACK/);
});
await run('TC-139','401,403,409,422,429,500,503 mapped states; Retry-After and backoff applied',async()=>{
  for(const [status,state] of [[401,'auth_required'],[403,'rejected'],[409,'conflict'],[422,'rejected'],[429,'retry_required'],[500,'retry_required'],[503,'retry_required']]){
    await clearRemote();await newAttempt(remote);const start=Date.now();await doRemote(makeRemote({status}));const q=await listOutbox(remote);
    assert(q.every(r=>r.state===state));if(status===429)assert(q.every(r=>r.next_at>=start+12000));
  }
});
await run('TC-140','Complete first produces missing sequence list and recovers after answer/start',async()=>{
  const a=await newAttempt(demo),m=new bridge.MockAdapter(demo), [start,answer,end]=await store.listEvents(a.attempt_id,demo);
  await m.startAttempt(bind(a));const b=makeBatch([end]),r=await m.sendEventBatch(b);assert.deepEqual(r.missing_sequences,[1,2]);
  const finalize=()=>m.completeAttempt({attempt_id:a.attempt_id,expected_event_count:3,final_event_id:end.event_id});
  assert.deepEqual((await finalize()).missing_sequences,[1,2]);await m.sendEventBatch(makeBatch([start,answer]));assert.equal((await finalize()).status,'complete');
});
await run('TC-141','Account/environment switch halts old outbox; subject mismatch blocks POST',async()=>{
  await clearRemote();const a=await newAttempt(remote),seen=[],api=makeRemote({seen,subject:'different'});
  await assert.rejects(()=>syncPending(remote,{adapter:api,getCurrentScope:()=>({...remote,profileId:'other'})}),/SCOPE_CHANGED/);
  assert.equal(seen.length,0);const events=await store.listEvents(a.attempt_id,remote);
  await assert.rejects(()=>api.sendEventBatch(makeBatch(events)),/SCOPE_CHANGED/);assert(!seen.some(([,req])=>req.method==='POST'));
  const m=new bridge.MockAdapter(demo);await assert.rejects(()=>m.sendEventBatch(makeBatch(events)),/SCOPE_MISMATCH/);
});
await run('TC-142','Mock server deadline uses receipt time and rejects late offline events',async()=>{
  const a=await newAttempt(demo),m=new bridge.MockAdapter(demo),b=makeBatch(await store.listEvents(a.attempt_id,demo));
  await m.startAttempt({...bind(a),deadline:'2020-01-01T00:00:00Z'});const r=await m.sendEventBatch(b);
  assert(r.receipts.every(x=>x.transport_result==='rejected'&&x.error_code==='DEADLINE_PASSED'));assert(r.received_at);assert(b.events[0].occurred_at_client);
});
await run('TC-143','Server transport accepted, grading stays unverified; receipt origin validated',async()=>{
  await clearRemote();await newAttempt(remote);await doRemote(makeRemote());assert((await listOutbox(remote)).every(r=>r.state==='server_accepted' && r.grading_state==='unverified'));
});
await run('TC-144','Unsupported schema rejected; existing outbox and payload preserved',async()=>{
  await clearRemote();await newAttempt(remote);const q=await listOutbox(remote);
  await assert.rejects(()=>doRemote(makeRemote({schemas:['99']})),/UNSUPPORTED_SCHEMA/);assert.deepEqual(await listOutbox(remote),q);
});
await run('TC-179','Explicit foreground drain without background sync, transient queue to mock receipt',async()=>{
  const s={...demo,profileId:'fg'};const a=await newAttempt(s);const res=await syncPending(s);
  assert.equal(res.sent,3);assert((await listOutbox(s)).every(r=>r.state==='mock_accepted'));assert.equal((await store.listEvents(a.attempt_id,s)).length,3);
});
await run('TC-184','Reject oversized, malformed and prototype-key import; data origins cannot be spoofed',async()=>{
  await assert.rejects(()=>readBackup('{"__proto__":{"x":1}}'),/INVALID_BACKUP/);
  const b=await exportBackup(local);b.data_origin='demo';await assert.rejects(()=>readBackup(b),/INVALID_BACKUP/);
  async function signed(mutator){
    const edited=structuredClone(await exportBackup(local));delete edited.checksum;await mutator(edited);
    edited.checksum=await sha256(canonical(edited,false));return edited;
  }
  const invalid=await signed(b=>{b.records.attempts[0].data.items[0].question.expression_ast={kind:'script'};});
  await assert.rejects(()=>readBackup(invalid),/INVALID_QUESTION/);
  const forged=await signed(async b=>{const e=b.records.events.find(r=>r.data.event_type==='answer.submitted').data;
    e.payload.client_is_correct=true;e.payload_hash=await eventHash(e);});
  await assert.rejects(()=>readBackup(forged),/INVALID_BACKUP_ATTEMPT/);
  const mismatched=await signed(b=>{b.records.attempts[0].data.items[0].question.question_id='DIFFERENT';});
  await assert.rejects(()=>readBackup(mismatched),/INVALID_BACKUP_ATTEMPT/);
  const fake=new Blob([' '.repeat(51*1024*1024)]);await assert.rejects(()=>readBackup(fake),/BACKUP_TOO_LARGE/);
});
await run('TC-137','Remote adapter over fake same-origin HTTP: bind → lost response after commit → duplicate replay → finalization → progress and scoped report',async()=>{
  const events=await store.listEvents((await newAttempt(remote)).attempt_id,remote), b=makeBatch(events);
  let serverBinding,finalized=false,disconnect=true;
  const seen=new Map(), requests=[];
  const fake=async(url,request)=>{
    const endpoint=new URL(url).pathname.replace('/api/v1','');
    assert.equal(request.credentials,'same-origin');requests.push(endpoint);
    if(request.method==='POST')assert.equal(request.headers['X-CSRF-Token'],'test');
    const body=request.body?JSON.parse(request.body):null;
    if(endpoint==='/capabilities')return Response.json({schema_versions:['1.0.0'],environment_id:remote.environment,max_events:100,max_bytes:262144});
    if(endpoint==='/me')return Response.json({subject:remote.profileId,environment_id:remote.environment});
    if(endpoint==='/attempts'){serverBinding=body.attempt_id;return Response.json(body);}
    if(endpoint==='/events/batch'){
      assert.equal(body.attempt_id,serverBinding);const r=ack(body);
      for(const [i,event] of body.events.entries()){
        const earlier=seen.get(event.event_id);
        if(earlier)r.receipts[i].transport_result=earlier===event.payload_hash?'duplicate':'conflict';
        else seen.set(event.event_id,event.payload_hash);
      }
      if(disconnect){disconnect=false;throw Error('synthetic timeout after remote commit');}
      return Response.json(r);
    }
    if(endpoint==='/attempts/complete'){
      assert(seen.has(body.final_event_id)&&seen.size===body.expected_event_count);
      finalized=true;return Response.json({status:'complete',grading_state:'queued',missing_sequences:[],attempt_id:serverBinding});
    }
    if(endpoint.endsWith('/progress'))return Response.json({items:[{attempt_id:serverBinding,complete:finalized}],data_origin:'lms_client',policy_version:'mastery-local-v1'});
    if(endpoint==='/reports')return Response.json({report_job_id:'qa-job',scope_id:body.scope_id,status:'queued',completed:0,total:1,failures:[]});
    if(endpoint==='/assignments')return Response.json({items:[],next_cursor:null});
    return new Response(null,{status:404});
  };
  const api=new bridge.RemoteApiAdapter(remote,{apiBaseUrl:'https://school.invalid/api/v1',environment_id:remote.environment,testOrigin:'https://school.invalid',csrfToken:'test',fetcher:fake});
  await api.getCapabilities();await api.getIdentity();assert.deepEqual((await api.listAssignments()).items,[]);
  await api.startAttempt({attempt_id:b.attempt_id,package_id:b.events[0].context.package_id,content_version:b.events[0].context.content_version,assignment_id:null,policy_version:b.events[0].context.policy_version});
  await assert.rejects(()=>api.sendEventBatch(b),/synthetic timeout/);
  const retried=await api.sendEventBatch(b);assert(retried.receipts.every(x=>x.transport_result==='duplicate'));assert.equal(seen.size,3);
  assert.equal((await api.completeAttempt({attempt_id:b.attempt_id,final_event_id:events[2].event_id,expected_event_count:3})).grading_state,'queued');
  assert((await api.getProgress()).items[0].complete);assert.equal((await api.requestReport({scope_type:'student',scope_id:remote.profileId,language:'id',format:'pdf',filters:{},policy_version:'mastery-local-v1'})).status,'queued');
  assert(requests.includes('/me')&&requests.includes('/events/batch'));
});
await run('TC-144','Malformed JSON, unsupported event version, cancelled batch and unavailable item revision retain local records',async()=>{
  const s={...demo,profileId:'schema-cases'},a=await newAttempt(s),events=await store.listEvents(a.attempt_id,s);
  const adapter=new bridge.MockAdapter(s);await adapter.startAttempt(bind(a));const b=makeBatch(events);
  const aborted=new AbortController();aborted.abort();await assert.rejects(()=>adapter.sendEventBatch(b,{signal:aborted.signal}),{name:'AbortError'});
  const wrong=structuredClone(events[0]);wrong.context.content_version='retired-version';wrong.payload_hash=await eventHash(wrong);
  assert.equal((await adapter.sendEventBatch(makeBatch([wrong]))).receipts[0].error_code,'VERSION_MISMATCH');
  wrong.schema_version='2.0.0';await assert.rejects(()=>adapter.sendEventBatch(makeBatch([wrong])),/UNSUPPORTED_SCHEMA/);
  const api=new bridge.RemoteApiAdapter(remote,{apiBaseUrl:'https://school.invalid/api/v1',environment_id:remote.environment,testOrigin:'https://school.invalid',fetcher:async()=>new Response('invalid JSON',{status:200})});
  await assert.rejects(()=>api.getCapabilities(),/MALFORMED_RESPONSE/);assert.deepEqual(await store.listEvents(a.attempt_id,s),events);
});
await run('TC-134','Recover a removed alias before a fresh start without transferring existing sessions to the default profile',async()=>{
  const old=await store.createProfile('Deleted alias'),oldScope=store.scopeForLocal(old.id),session=await newAttempt(oldScope,false);
  await store.deleteProfile(old.id);store.selectScope(oldScope);
  const recovered=await store.resolveActiveScope();assert.equal(recovered.profileId,'local-default');
  await assert.rejects(()=>store.saveAttempt(session,null,oldScope),/PROFILE_REMOVED/);
  assert.equal(await store.getAttempt(session.attempt_id,recovered),null);
  const fresh=await newAttempt(recovered);assert.equal(fresh.profile_id,'local-default');
});
const output={runtime:process.version,environment:'Node ES modules, transactional in-memory fallback, deterministic mock and same-origin HTTP contract fetch harness. No live LMS or browser IDB assertions in this run.',results};
await mkdir(new URL('../../evidence/data/',import.meta.url),{recursive:true});
await writeFile(new URL('../../evidence/data/contract-results.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(results.filter(r=>r.status==='PASS').length+'/'+results.length);if(results.some(r=>r.status!=='PASS'))process.exitCode=1;
