import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {exportBackup,previewBackup} from '../../src/data/backup.js';
import {prepareSession,launchPrepared} from '../../src/player/start.mjs';
import {begin,visit,editDraft,submit,finish} from '../../src/player/engine.mjs';
import {selectScope,createProfile,scopeForLocal,getAttempt,listAttempts,saveAttempt,usedPackages,queryAttemptSummaries} from '../../src/data/store.js';
import {readMaterial,rememberMaterial,clearMaterial,questionCount} from '../../src/core/material.mjs';

const dist=new URL('../../dist/',import.meta.url);
globalThis.document={baseURI:dist.href};
globalThis.location=new URL(dist.href);
globalThis.fetch=async u=>new Response(await readFile(new URL(u)),{status:200});
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
localStorage.setItem('kalibataku.preferences.v1',JSON.stringify({grade:12,level:5,op:'MIX',lang:'en'}));
const ctx={lang:'en',signal:new AbortController().signal};
const profileA=scopeForLocal((await createProfile('A')).id),profileB=scopeForLocal((await createProfile('B')).id);
selectScope(profileA);
const counts={},rows=[];
for(const scope of [profileA,profileB])assert.equal(readMaterial(scope),null);
rememberMaterial(profileA,{grade:7,level:3,comp:{operation:'MUL'}});
assert.deepEqual(readMaterial(profileA),{grade:7,level:3,op:'MUL'});
assert.equal(readMaterial(profileB),null);
clearMaterial(profileA);assert.equal(readMaterial(profileA),null);
assert.deepEqual([questionCount(1,'en'),questionCount(9,'en'),questionCount(1,'id')],['1 question','9 questions','1 soal']);
const options={grade:1,level:1,operation:'ADD',question_count:2};
async function verify(mode,extra={}){
  const before=(await listAttempts(profileA)).length;
  const plan=await prepareSession(ctx,{...options,mode,...extra});
  assert.equal((await listAttempts(profileA)).length,before,'preview must not persist attempts');
  const [id,same]=await Promise.all([launchPrepared(ctx,plan),launchPrepared(ctx,plan)]);assert.equal(id,same);
  const a=await getAttempt(id,profileA);
  assert.deepEqual([a.package_id,a.content_version,a.mode,a.items.length,a.duration_seconds,a.form_id,a.grade,a.level,a.operation],
    [plan.entry.package_id,plan.entry.content_version,plan.mode,plan.count,plan.seconds,plan.pkg.form_id,plan.pkg.grade,plan.pkg.level,plan.pkg.operation]);
  assert.equal(a.ready,false);assert.equal(a.deadline,null);
  assert.equal((await listAttempts(profileA)).length,before+1,'no duplicate on two clicks');
  rows.push({mode,purpose:plan.entry.purpose,form_id:a.form_id,version:a.content_version,package:a.package_id,displayed_count:plan.count,attempt_count:a.items.length,duration:a.duration_seconds,preview_writes:0,double_click_attempts:1});
  counts[mode]=(counts[mode]||0)+1;
  return a;
}
await assert.rejects(prepareSession(ctx,{...options,mode:'recovery'}),/RECOVERY_EMPTY/);
await assert.rejects(prepareSession(ctx,{...options,mode:'practice',question_count:500}),/INVALID_COUNT/);
const p=await verify('practice');
const stamp=Date.now();
await saveAttempt(p,begin(p,stamp),profileA);
editDraft(p,0,'999','en');await saveAttempt(p,submit(p,0,stamp+300),profileA);
visit(p,1,stamp+400);editDraft(p,1,p.items[1].question.answer.numerator,'en');await saveAttempt(p,submit(p,1,stamp+500),profileA);
await saveAttempt(p,finish(p,{now:stamp+1000}),profileA);
assert((await usedPackages(profileA,{status:'completed'})).has(p.package_id));
assert(!(await usedPackages(profileA,{status:'ongoing'})).has(p.package_id));
const savedOrig=await getAttempt(p.attempt_id,profileA),sourceSnapshot=JSON.stringify(savedOrig),similarCases=[];
for(const item of savedOrig.items){
  const variation=await verify('practice',{fromAttempt:p.attempt_id,fromItem:item.question_instance_id});
  const v=variation.items[0];
  assert.equal(variation.items.length,1);
  assert.equal(v.question.template_id,item.question.template_id);assert.equal(v.question.competency_id,item.question.competency_id);
  assert.notEqual(v.question.fingerprint,item.question.fingerprint);assert.notEqual(v.question.question_id,item.question.question_id);
  assert.equal(v.source_attempt_id,p.attempt_id);assert.equal(v.source_instance_id,item.question_instance_id);
  assert.equal(v.source_fingerprint,item.question.fingerprint);assert.equal(v.practice_role,'similar');
  similarCases.push({source_final_status:item.final_status,source_question_id:item.question.question_id,variant_question_id:v.question.question_id,source_fingerprint:item.question.fingerprint,variant_fingerprint:v.question.fingerprint,template:v.question.template_id,scope_owner:variation.profile_id===p.profile_id});
}
assert.deepEqual(similarCases.map(c=>c.source_final_status),['incorrect','correct']);
assert.equal(JSON.stringify(await getAttempt(p.attempt_id,profileA)),sourceSnapshot);
const backup=await exportBackup(profileA);
const roundtrip=await previewBackup(backup);assert.equal(roundtrip.conflicts.length,0);assert.equal(roundtrip.additions,0);
await assert.rejects(prepareSession(ctx,{...options,mode:'practice',fromAttempt:p.attempt_id,fromItem:'unavailable'}),/VARIANT_SOURCE/);
const summaries=await queryAttemptSummaries(profileA,{status:'ongoing',limit:1});
assert.equal(summaries.rows.length,1);assert(summaries.rows[0].last_saved_at);

const recovery=await verify('recovery',{question_count:99});
assert.equal(recovery.items.length,2);
assert.equal(recovery.items[0].source_attempt_id,p.attempt_id);
assert.equal(recovery.items[1].recovery_role,'variation');
await verify('speed',{duration_seconds:120});
const adaptive=await verify('adaptive');
assert.equal(adaptive.adaptive.decision,'collect');
const formA=await verify('assessment'),formB=await verify('assessment');
assert.notEqual(formA.form_id,formB.form_id);assert.equal(formA.items.length,10);
const cross=await prepareSession(ctx,{...options,mode:'practice'});selectScope(profileB);
await assert.rejects(launchPrepared(ctx,cross),/WRONG_PROFILE/);
assert.equal((await listAttempts(profileB)).length,0);
await assert.rejects(prepareSession(ctx,{...options,mode:'practice',fromAttempt:p.attempt_id,fromItem:p.items[0].question_instance_id}),/VARIANT_SOURCE/);
assert.equal((await usedPackages(profileB,{status:'completed'})).size,0);
const binding={release:JSON.parse(await readFile(new URL('offline-assets.json',dist))).release,files:{}};
for(const path of ['player/start.mjs','core/catalog.mjs','core/material.mjs','core/home.mjs','core/package-data.mjs','bank/index.json'])binding.files[path]=createHash('sha256').update(await readFile(new URL(path,dist))).digest('hex');
const evidence={status:'PASS',binding,runtime:process.version,storage:'Node temporary store',test:'tests/ui/session-plan.mjs',modes:counts,cases:rows,similar_items:similarCases,scope_and_preferences:['legacy unowned study grade ignored','per-profile topic isolation','removal clears last topic','switching profile blocks a prepared session'],bounds:['count exceeds pool rejected','empty recovery rejected','ID/EN pluralization'],limitations:'Tests run the exported resolver and commit, not physical input, actual assistive technology or a user study.'};
if(process.argv.includes('--evidence')){
  const directory=new URL('../../evidence/ux/shell/',import.meta.url);await mkdir(directory,{recursive:true});
  await writeFile(new URL('session-plan.json',directory),JSON.stringify(evidence,null,2)+'\n');
}
console.log(JSON.stringify(evidence,null,2));
