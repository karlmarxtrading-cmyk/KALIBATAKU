// Frozen 1.4.0 audit fixture created with the original production engine and four
// actual package attempts (P002 catalog, P001 intro and two regular missions).
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const releaseTree=process.argv.includes('--dist')?'dist':'src';
const root=fileURLToPath(new URL('../../',import.meta.url));
const outputArg=process.argv.slice(2).find(arg=>arg!=='--dist');
const out=resolve(outputArg||root+'evidence/v15/reports');
const load=rel=>import(new URL('../../'+releaseTree+'/'+rel,import.meta.url));
const {journeyState}=await load('journey/model.mjs');
const {buildSnapshot,initialFilters}=await load('teacher/report.js');
const {encode}=await load('teacher/export/index.js');
const {validateSnapshot}=await load('data/snapshot-check.js');
const {createAttempt,begin,visit,editDraft,submit,finish,noteHint}=await load('player/engine.mjs');
const {saveAttempt,listEvents,scopeForLocal,createProfile}=await load('data/store.js');

const file=async p=>readFile(resolve(root,p)),json=async p=>JSON.parse(await file(p));
await mkdir(out,{recursive:true});
const frozen=await json('tests/journey/fixtures/report-audit-04-v14.json');
const attempts=frozen.bundles.map(b=>b.attempt);
for(const b of frozen.bundles)await validateSnapshot(b.attempt,b.events);
const nodeId='arithmetic.addition.g01.l01',route=await json(releaseTree+'/journey/v1/route.json');
const person={id:frozen.profile_id,alias:'Siswa uji AUD-04',classId:'A'};
const createdAt='2026-11-30T12:00:00.000Z';
const base={...initialFilters(),timezone:'UTC',source:'local_practice'};
function report(records,filters={},at=createdAt){
  return buildSnapshot({person,people:[person],attempts:records,filters:{...base,...filters},createdAt:at,locale:'en'});
}
const get=s=>s.journey.rows.find(r=>r.node_id===nodeId);
const fields=r=>[r.unique_seen,r.rule.coverage_needed,r.passing_missions,r.strategies_seen,r.ready];
const checks=[];
function check(name,actual,expected){
  assert.deepEqual(actual,expected,name);checks.push({name,expected,actual});
}
const checksum=x=>createHash('sha256').update(x).digest('hex');
const immutableBefore=checksum(JSON.stringify(attempts));
const state=journeyState(route,attempts),node=state.nodes.get(nodeId);
check('map fixture', [node.coverage,node.coverage_needed,node.passing.size,node.strategies_seen,node.ready],[12,12,2,2,true]);
const combined=report(attempts);
check('mixed catalog and missions',fields(get(combined)),[12,12,2,2,true]);
check('journey-only coverage',fields(get(report(attempts.slice(1)))),[10,12,2,2,false]);
const emptyPeriod=report(attempts,{from:'2026-11-29',to:'2026-11-29'});
check('empty selected period retains cumulative readiness',[emptyPeriod.completed,get(emptyPeriod).missions,emptyPeriod.journey.xp,...fields(get(emptyPeriod))],
  [0,0,0,12,12,2,2,true]);
const filtered=report(attempts,{packageId:attempts[0].package_id});
check('catalog-only activity filter retains journey passes',[filtered.completed,get(filtered).missions,...fields(get(filtered))],[1,0,12,12,2,2,true]);
check('grade filter omits unrelated material',report(attempts,{grade:'12'}).journey.rows.length,0);
const finalAt=Date.parse(attempts.at(-1).completed_at);
check('generation time cutoff immediately before finalization',get(report(attempts,{},new Date(finalAt-1).toISOString())).passing_missions,1);
check('generation time includes same-instant commit',get(report(attempts,{},new Date(finalAt).toISOString())).passing_missions,2);
const midnight=structuredClone(attempts);
midnight.at(-1).completed_at='2026-11-29T00:00:00.000Z';
check('report period upper bound is exclusive',[get(report(midnight,{to:'2026-11-28'})).passing_missions,get(report(midnight,{from:'2026-11-29'})).passing_missions],[1,2]);
const beforeMidnight=report(midnight,{to:'2026-11-28'});
check('cross-midnight session has no future answers or completion in period activity',[
  beforeMidnight.completed,beforeMidnight.ongoing,beforeMidnight.sessions.find(a=>a.id===midnight.at(-1).attempt_id).N,get(beforeMidnight).missions
],[3,1,0,2]);
const hidden=attempts.map(a=>({...a,data_origin:'demo'}));
check('profile, origin, module and class isolation',[
  report(attempts.map(a=>({...a,profile_id:'other'}))).journey.rows.length,report(hidden).journey.rows.length,
  report(attempts.map(a=>({...a,module_id:'other'}))).journey.rows.length,report(attempts,{classId:'other'}).journey.rows.length],[0,0,0,0]);
const unknown=structuredClone(attempts.at(-1));unknown.journey.policy_version='unrecognized';
check('unsupported journey is excluded from readiness',report([unknown]).journey.rows.length,0);
check('frozen metrics use current rule and retain original policy in session record',[
  combined.journey.mission_policy,combined.sessions.find(s=>s.journey_at_creation)?.journey_at_creation.mission_policy
],[route.mission_policy.policy_version,'mission-policy-1.0.0']);
check('legacy data unchanged after reports',checksum(JSON.stringify(attempts)),immutableBefore);
const itemSource=attempts.at(-1),assistedProfile=await createProfile('AUD-04 synthetic'),scope=scopeForLocal(assistedProfile.id);
const {default:pkg}=await import('../../dist/bank/v1.2/g01/l01/MM-G01-L01-ADD-P001.mjs');
let clock=Date.parse('2026-11-29T05:00:00Z');
const tick=()=>clock+=1000;
const items=itemSource.items.map(({journey_role,journey_band,journey_review,occurrence_ref})=>({question:pkg.questions[occurrence_ref.question_index],journey_role,journey_band,journey_review,occurrence_ref}));
const assisted=createAttempt(pkg,scope,{items,journey:structuredClone(itemSource.journey),seed:itemSource.journey.seed,now:tick()});
await saveAttempt(assisted,null,scope);await saveAttempt(assisted,begin(assisted,tick()),scope);
let targetCount=0;
for(const [i,it] of assisted.items.entries()){
  visit(assisted,i,tick());
  if(it.journey_role==='t'){
    targetCount++;
    if(targetCount===1){editDraft(assisted,i,'-999','id');await saveAttempt(assisted,submit(assisted,i,tick()),scope);}
    if(targetCount===2)noteHint(assisted,i);
  }
  const answer=it.question.answer;
  editDraft(assisted,i,answer.denominator==='1'?answer.numerator:answer.numerator+'/'+answer.denominator,'id');
  await saveAttempt(assisted,submit(assisted,i,tick()),scope);
}
for(const e of finish(assisted,{now:tick()}))await saveAttempt(assisted,e,scope);
await validateSnapshot(assisted,await listEvents(assisted.attempt_id,scope));
const assistedPerson={...person,id:assistedProfile.id};
const result=get(buildSnapshot({person:assistedPerson,people:[assistedPerson],attempts:[assisted],filters:base,createdAt}));
check('hint and revision after key do not award a passing mission',[
  result.first_total,result.first_independent,result.assisted,result.revised_after_key,result.passing_missions,result.ready],[8,6,2,1,0,false]);
const font=[await file(releaseTree+'/teacher/font/DejaVuSans.ttf'),await json(releaseTree+'/teacher/font/metrics.json')],files=[];
for(const format of ['json','csv','xlsx','docx','pdf']){
  const data=await encode(combined,format,{font});await writeFile(resolve(out,'report.'+format),data);
  files.push({format,bytes:data.byteLength,sha256:checksum(data)});
}
check('decoded exported JSON equals audited expected values',fields(get(JSON.parse(await readFile(resolve(out,'report.json'))))),[12,12,2,2,true]);
const receipt={suite:'AUD-04',scope:'Node engine, immutable validated 1.4.0 snapshots and new assisted mission, map and report writers',date:new Date().toISOString(),runtime:process.version,
 release_tree:releaseTree,offline_release:JSON.parse(await file('dist/offline-assets.json')).release,command:'node tests/journey/report-readiness.mjs '+(releaseTree==='dist'?'--dist ':'')+'[output-dir]',expected:'12/12 unique, 2 passing, 2 strategies, ready',checks,files};
await writeFile(resolve(out,'node-acceptance.json'),JSON.stringify(receipt,null,2)+'\n');
console.log('PASS',checks.length,'AUD-04 scenario checks, 5 actual report formats');
