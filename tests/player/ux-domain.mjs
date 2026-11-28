import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {begin,createAttempt,editDraft,commitDraft,visit,finish,clearResponse,submit,noteHint,projectFinal,deadlineRemaining} from '../../src/player/engine.mjs';
import {createProfile,scopeForLocal,saveAttempt,listEvents,getAttempt} from '../../src/data/store.js';
import {exportBackup,readBackup} from '../../src/data/backup.js';
import {validateSnapshot} from '../../src/data/snapshot-check.js';
import {syncPending,listOutbox} from '../../src/data/sync.js';
const root=new URL('../../',import.meta.url),file=path=>new URL(path,root);
const meta=JSON.parse(readFileSync(file('dist/bank/g01/l01.json'))).competencies.find(c=>c.operation==='ADD');
const entry=meta.packages.find(p=>p.package_id==='MM-G01-L01-ADD-P001');
const pkg=(await import(file('dist/'+entry.url))).default;
const scope=scopeForLocal((await createProfile('Synthetic domain profile')).id);
const demo={origin:'demo',environment:'demo',profileId:'synthetic-player-ux'};
const evidence={runtime:process.version,layer:'actual release engine, store, schema/ledger validator, explicit temporary storage; demo mock adapter',package:pkg.package_id,version:pkg.content_version,package_sha256:entry.sha256,engine_sha256:createHash('sha256').update(readFileSync(file('src/player/engine.mjs'))).digest('hex'),cases:[]};
const cases=evidence.cases;
function attempt(mode,owner=scope){return createAttempt(pkg,owner,{lang:'id',mode,question_count:2,duration_seconds:mode==='speed'?2:0});}
async function started(mode,owner){const a=attempt(mode,owner);await saveAttempt(a,begin(a),owner);return a;}
function preview(a,opts){const before=JSON.stringify(a);const model=projectFinal(a,opts);assert.equal(JSON.stringify(a),before);return model;}
let n=0;
for(const mode of ['practice','speed','adaptive','recovery','assessment']){
  const owner=n++%2?demo:scope,a=await started(mode,owner),ids=a.items.map(i=>i.question_instance_id);
  editDraft(a,0,'5');await saveAttempt(a,commitDraft(a,0),owner);visit(a,1);editDraft(a,1,'4');
  const {counts}=preview(a);assert.equal(counts.correct,2);assert.equal(counts.blank,0);assert.equal(counts.unseen,a.items.length-2);
  const commands=finish(a);await saveAttempt(a,commands,owner);
  const events=await listEvents(a.attempt_id,owner);await validateSnapshot(a,events);
  assert.equal(a.metrics.C,2);assert.equal(a.metrics.B,0);assert.equal(events.length,4);
  assert.deepEqual(events.map(e=>e.event_sequence),[1,2,3,4]);
  assert.equal(events.at(-1).payload.expected_event_count,4);
  assert.deepEqual(events.at(-1).payload.final_responses.slice(0,2).map(f=>f.response_event_id),events.slice(1,3).map(e=>e.event_id));
  assert.deepEqual(ids,a.items.map(i=>i.question_instance_id));assert.deepEqual(finish(a),[]);
  assert.equal((await getAttempt(a.attempt_id,owner)).metrics.C,2);
  cases.push({test:'valid draft on move and final, idempotent, ledger and final references',mode,counts,metrics:a.metrics,event_sequence:events.map(e=>[e.event_sequence,e.event_type]),status:'PASS'});
}
for(const mode of ['practice','speed','adaptive','recovery','assessment']){
  const a=await started(mode,scope);editDraft(a,0,'999');await saveAttempt(a,submit(a,0),scope);
  if(mode!=='assessment')noteHint(a,0);editDraft(a,0,'5');visit(a,1);editDraft(a,1,'1/');
  const before=JSON.stringify(a);assert.throws(()=>finish(a),/DIRTY_INVALID/);
  assert.equal(JSON.stringify(a),before);assert.equal(preview(a).counts.incomplete,1);
  clearResponse(a,1);assert.equal(preview(a).counts.correct,1);await saveAttempt(a,finish(a),scope);
  await validateSnapshot(a,await listEvents(a.attempt_id,scope));
  assert.deepEqual(a.items[0].history.map(h=>h.raw_answer),['999','5']);assert.equal(a.metrics.C,1);assert.equal(a.metrics.first_correct,0);assert.equal(a.metrics.W,0);assert.equal(a.metrics.B,1);
  cases.push({test:'manual invalid blocks all, corrected revision retained, explicit blank',mode,first_final:a.items[0].history.map(h=>({answer:h.raw_answer,kind:h.submission_kind,hint:h.hint_used})),metrics:a.metrics,status:'PASS'});
}
for(const mode of ['speed','assessment']){
  for(const prior of ['none','incorrect','skipped']){
    const a=await started(mode,scope);
    if(prior==='incorrect'){editDraft(a,0,'999');await saveAttempt(a,submit(a,0),scope);}
    if(prior==='skipped')await saveAttempt(a,clearResponse(a,0,true),scope);
    editDraft(a,0,'1/');visit(a,1);editDraft(a,1,'4');
    const fixedTime=Date.parse(a.started_at)+2000,counts=preview(a,{expired:true}).counts;
    await saveAttempt(a,finish(a,{expired:true,now:fixedTime}),scope);
    const events=await listEvents(a.attempt_id,scope);await validateSnapshot(a,events);
    assert.equal(a.items[0].unsubmitted_draft.text,'1/');assert.equal(a.items[0].final_status,prior==='none'?'blank':prior);assert.equal(a.items[1].final_status,'correct');
    assert.equal(a.metrics.C,counts.correct);assert.equal(a.metrics.S,counts.skipped);assert.equal(a.metrics.B,counts.blank);assert.equal(a.metrics.W,counts.incorrect);
    if(a.deadline)assert.equal(deadlineRemaining(a,fixedTime),0);
    cases.push({test:'deadline commits valid draft, archives malformed draft and counts previous answer/skip/blank',mode,prior,counts,status:'PASS'});
  }
}
const copy=await readBackup(await exportBackup(scope));
assert.ok(copy.records.attempts.length>=10);cases.push({test:'real formal local backup accepted by independent snapshot and ledger validator',attempts:copy.records.attempts.length,status:'PASS'});
const sent=await syncPending(demo),outbox=await listOutbox(demo);assert.equal(sent.sent,8);assert.ok(outbox.every(o=>o.grading_state==='unverified'&&o.state==='mock_accepted'));
cases.push({test:'mock bridge accepts both synthesized final submission sequences without institutional verification',sent:sent.sent,grading_state:outbox[0].grading_state,status:'PASS'});
mkdirSync(file('evidence/ux/player/'),{recursive:true});writeFileSync(file('evidence/ux/player/finalization.json'),JSON.stringify(evidence,null,2)+'\n');console.log(cases.length+' player domain/ledger scenarios passed');
