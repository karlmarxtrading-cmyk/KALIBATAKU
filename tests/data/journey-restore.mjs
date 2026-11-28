// Synthetic local profiles, production snapshot/ledger and JSON/ZIP writer, reader, preview and transaction.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createAttempt,begin,visit,editDraft,submit,finish} from '../../src/player/engine.mjs';
import {canonical,scopeKey} from '../../src/data/common.js';
import {transaction,row} from '../../src/data/db.js';
import {createProfile,scopeForLocal,addRecord,saveAttempt,listAttempts,deleteProfile,listProfiles} from '../../src/data/store.js';
import {exportBackup,exportArchive,readAny,previewBackup,importBackup} from '../../src/data/backup.js';
import {journeyState,planMission} from '../../src/journey/model.mjs';

const root=new URL('../../',import.meta.url),readJSON=async path=>JSON.parse(await readFile(new URL(path,root)));
const route=await readJSON('src/journey/v1/route.json'),node=route.nodes.find(n=>n.competency_id==='arithmetic.addition.g03.l01');
const shard=await readJSON('src/'+node.occ.url),plan=planMission({shard,kind:'regular',policy:route.mission_policy,seed:77});
const levelPath='bank/g03/l01.json',catalog=await readJSON('dist/'+levelPath);
const entry=catalog.competencies.flatMap(n=>n.packages).find(p=>p.package_id===plan.package.package_id);
const pack=(await import(new URL('dist/'+entry.url,root))).default;
const profile=await createProfile('Synthetic restore fixture'),scope=scopeForLocal(profile.id),ns=scopeKey(scope);
const other=await createProfile('Independent profile'),otherScope=scopeForLocal(other.id);
await addRecord('test','other',{count:14},otherScope);
const legacy=createAttempt(pack,scope,{question_count:2});delete legacy.flow_policy_version;
await saveAttempt(legacy,begin(legacy),scope);
const refs=plan.rows.map(r=>{
  const q=pack.questions[r.index];
  return {package_id:pack.package_id,content_version:pack.content_version,package_sha256:entry.sha256,
    question_index:r.index,question_id:q.question_id,question_revision:q.question_revision};
});
const items=plan.rows.map((r,n)=>({question:pack.questions[r.index],journey_role:r.role,journey_band:r.band,journey_review:r.review,occurrence_ref:refs[n]}));
const snapshot=createAttempt(pack,scope,{items,seed:77,journey:{
  journey_id:'kalibataku-adventure',node_id:node.competency_id,stage_id:node.stage_id,mission_kind:'regular',
  metadata_version:route.metadata_version,route_version:route.route_version,policy_version:route.mission_policy.policy_version,
  seed:77,selected_occurrence_refs:refs,selection_trace:plan.trace,
  readiness_rule:{target_missions:2,min_rate:0.8,coverage_needed:12,strategies_needed:2,label:'product_policy_not_psychometric'}
}});
await saveAttempt(snapshot,begin(snapshot),scope);
for(const [i,item] of snapshot.items.entries()){
  visit(snapshot,i);
  const {numerator,denominator}=item.question.answer;
  editDraft(snapshot,i,denominator==='1'?numerator:numerator+'/'+denominator);
  await saveAttempt(snapshot,submit(snapshot,i),scope);
}
await saveAttempt(snapshot,finish(snapshot),scope);
// Use the stored row (including the commit timestamp) for exact round-trip comparisons.
const original=(await listAttempts(scope)).find(a=>a.attempt_id===snapshot.attempt_id);
const histories=async s=>(await exportBackup(s)).records;
const initial=await histories(scope),otherInitial=await histories(otherScope);
const saveFixture=data=>transaction(['attempts'],true,tx=>tx.put('attempts',row(ns,data.attempt_id,data)));
const files=async()=>[['JSON',new Blob([JSON.stringify(await exportBackup(scope))])],['ZIP',await exportArchive(scope)]];
const evidence=[],passed=(id,actual)=>{evidence.push({id,status:'PASS',actual});};

const validFiles=await files();
for(const [format,file] of validFiles){
  await deleteProfile(scope.profileId);
  assert(!(await listProfiles()).some(p=>p.id===scope.profileId));
  const preview=await previewBackup(file);assert(preview.additions>4);assert.equal(preview.journey_checks.internal_only,1);
  const result=await importBackup(file);assert.equal(result.additions,preview.additions);assert.equal((await importBackup(file)).additions,0);
  assert.deepEqual(await histories(scope),initial);assert.deepEqual(await histories(otherScope),otherInitial);
  passed('offline-roundtrip-'+format,{newRecords:result.additions,journey:preview.journey_checks,identicalStoredRows:true,legacy13:true,duplicateAdditions:0});
}

const cases=[
  ['audit-node',a=>{a.journey.node_id='arithmetic.addition.g12.l05';a.journey.stage_id='S-G12-L05';}],
  ['audit-occurrence',a=>{Object.assign(a.items[0].occurrence_ref,{question_index:999999,package_id:'MM-G12-L05-ADD-P999'});a.journey.selected_occurrence_refs[0]={...a.items[0].occurrence_ref};}],
  ['audit-readiness',a=>{a.journey.readiness_rule={target_missions:0,min_rate:-1,coverage_needed:-1,strategies_needed:-1};}],
  ['audit-selected-count',a=>{a.journey.selected_occurrence_refs=[];}],
  ['role-domain',a=>{a.items[0].journey_role='unrecognized';}],
  ['band-domain',a=>{a.items[0].journey_band=4;}],
  ['selected-order',a=>{a.journey.selected_occurrence_refs.reverse();}],
  ['form-reserved',a=>{a.journey.selection_trace.candidates[0].package_id='MM-G03-L01-ADD-P011';}],
  ['candidate-index-range',a=>{a.items[0].occurrence_ref.question_index=39;a.journey.selected_occurrence_refs[0]={...a.items[0].occurrence_ref};}],
  ['policy-change-within-range',a=>{a.journey.readiness_rule.coverage_needed=1;}],
  ['unknown-version',a=>{a.journey.route_version='route-2030.0.0';},'UNSUPPORTED_BACKUP_JOURNEY'],
  ['item-revision',a=>{a.items[0].occurrence_ref.question_revision='1.1.0';a.journey.selected_occurrence_refs[0]={...a.items[0].occurrence_ref};}],
  ['dangling-intent',a=>{a.journey.start_intent_id='missing';a.journey.start_intent_step=1;}]
];
for(const [name,change,error='INVALID_BACKUP_JOURNEY'] of cases){
  const altered=structuredClone(original);change(altered);
  await saveFixture(altered);
  const invalidFiles=await files();
  await saveFixture(original);
  for(const [format,file] of invalidFiles){
    for(const action of [readAny,previewBackup,importBackup])await assert.rejects(()=>action(file),{code:error});
    assert.deepEqual(await histories(scope),initial);assert.deepEqual(await histories(otherScope),otherInitial);
    passed(name+'-'+format,{reader:error,preview:error,commit:error,unchangedProfiles:2});
  }
}

// A failing new-profile restore must not even add the profile header or the legacy attempt.
const damaged=structuredClone(original);damaged.journey.selected_occurrence_refs=[];
await saveFixture(damaged);const broken=await files();await deleteProfile(scope.profileId);
for(const [format,file] of broken){
  await assert.rejects(()=>importBackup(file),{code:'INVALID_BACKUP_JOURNEY'});
  assert(!(await listProfiles()).some(p=>p.id===scope.profileId));assert.equal((await listAttempts(scope)).length,0);
  assert.deepEqual(await histories(otherScope),otherInitial);
  passed('absent-destination-atomicity-'+format,{createdProfiles:0,createdAttempts:0});
}
await importBackup(validFiles[0][1]);

// A cached, independently hash-pinned bank package permits comparison of the entire question.
const inputs = new Map();
for(const [path,local] of [[levelPath,'dist/'+levelPath],[node.occ.url,'src/'+node.occ.url],[entry.url,'dist/'+entry.url]]){
  inputs.set(new URL('src/'+path,root).href,await readFile(new URL(local,root)));
}
globalThis.caches={match:async url=>inputs.has(url)?new Response(inputs.get(url)):undefined};
for(const [format,file] of validFiles){
  const checked=await previewBackup(file);assert.equal(checked.journey_checks.bank_matched,1);
  passed('trusted-bank-'+format,checked.journey_checks);
}
// Same mathematically coherent snapshot, but the wording differs from its actual bank item.
const mismatch=structuredClone(original);mismatch.items[0].question.hint.id += ' *';
await saveFixture(mismatch);const mismatchedFiles=await files();await saveFixture(original);
for(const [format,file] of mismatchedFiles){
  await assert.rejects(()=>importBackup(file),{code:'INVALID_BACKUP_JOURNEY'});assert.deepEqual(await histories(scope),initial);
  passed('bank-content-mismatch-'+format,{checksumValid:true,commit:'INVALID_BACKUP_JOURNEY'});
}
// A retired cache at the same catalogue URL must not shadow the pinned copy.
const liveURL=new URL('src/'+levelPath,root).href;
globalThis.caches={
  keys:async()=>['previous','current'],
  match:async(url,options)=>url===liveURL && options?.cacheName!=='current' ?
    new Response(JSON.stringify({older:true})) : inputs.has(url)?new Response(inputs.get(url)):undefined
};
assert.equal((await previewBackup(validFiles[0][1])).journey_checks.bank_matched,1);
passed('coexisting-release-caches',{matchedCurrentCatalog:true});
inputs.delete(new URL('src/'+entry.url,root).href);
assert.equal((await previewBackup(validFiles[0][1])).journey_checks.occurrences_matched,1);
passed('shard-only',{occurrences_matched:1});
inputs.clear();
assert.equal((await previewBackup(validFiles[0][1])).journey_checks.internal_only,1);
passed('historical-catalog-only',{internal_only:1,requiresNetwork:false});
delete globalThis.caches;

// Old policy values are interpreted exactly, independently of the currently generated route.
const historical=structuredClone(original);Object.assign(historical.journey,{route_version:'route-1.0.0',policy_version:'mission-policy-1.0.0'});
Object.assign(historical.journey.selection_trace,{selector_version:'selector-1.0.0',policy_version:'mission-policy-1.0.0'});
await saveFixture(historical);
for(const [format,file] of await files()){
  const read=await readAny(file);
  const actual=read.records.attempts.find(r=>r.id===historical.attempt_id).data;
  assert.equal(canonical(actual,false),canonical(historical,false));passed('supported-1.4-'+format,{preserved:true});
}
const unknown=structuredClone(historical);unknown.journey.route_version='route-unknown';
const state=journeyState(route,[unknown]);
assert.equal(state.journeyAttempts,0);assert.equal(state.xp,0);assert.equal(state.nodes.get(node.competency_id).coverage,0);
passed('unknown-policy-existing-history',{journeyAttempts:0,xp:0,coverage:0,rawAttemptPreserved:true});

const directory=new URL('evidence/v15/restore/',root);
await mkdir(directory,{recursive:true});
await writeFile(new URL('results.json',directory),JSON.stringify({
  command:'node tests/data/journey-restore.mjs',at:new Date().toISOString(),runtime:process.version,
  offline_release:(await readJSON('dist/offline-assets.json')).release,
  environment:'Node memory transaction adapter; synthetic profiles; local bank bytes via CacheStorage interface for installed-source cases',
  expected:'Valid, supported data round trips exactly; invalid inputs fail reader, preview and commit atomically.',
  cases:evidence
},null,2)+'\n');
console.log(evidence.length+' PASS');
