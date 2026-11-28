import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
if(!process.argv[2])throw new Error('Usage: node journey_report_consistency.mjs SOURCE_ROOT [OUTPUT_JSON]');
const root=resolve(process.argv[2]);
const output=process.argv[3]?resolve(process.argv[3]):fileURLToPath(new URL('journey-report-consistency-rerun.json',import.meta.url));
const mod=rel=>import(pathToFileURL(resolve(root,rel)).href);
const {planMission,exposure,journeyState,nextMission}=await mod('src/journey/model.mjs');
const {journeySummary}=await mod('src/journey/report.mjs');
const {buildSnapshot,initialFilters}=await mod('src/teacher/report.js');
const {encode}=await mod('src/teacher/export/index.js');
const {createAttempt,begin,visit,editDraft,submit,finish}=await mod('src/player/engine.mjs');
const {createProfile,scopeForLocal,saveAttempt,listEvents}=await mod('src/data/store.js');
const {validateSnapshot}=await mod('src/data/snapshot-check.js');
const route=JSON.parse(await readFile(resolve(root,'src/journey/v1/route.json'),'utf8'));
const nodeId='arithmetic.addition.g01.l01',node=route.nodes.find(n=>n.competency_id===nodeId);
const shard=JSON.parse(await readFile(resolve(root,'src/journey/v1/occ/'+nodeId+'.json'),'utf8'));
const packages=new Map();
for(const p of shard.packages){
 const file='dist/bank/v1.2/g01/l01/'+p.package_id+'.mjs';
 packages.set(p.package_id,(await mod(file)).default);
}
const profile=await createProfile('Audit fixture'),scope=scopeForLocal(profile.id);
let now=Date.parse('2026-11-28T01:00:00Z');
const tick=()=>now+=2500;
const answer=q=>q.answer.denominator==='1'?q.answer.numerator:q.answer.numerator+'/'+q.answer.denominator;
const validations=[];
async function complete(a){
 await saveAttempt(a,null,scope);
 await saveAttempt(a,begin(a,tick()),scope);
 for(let i=0;i<a.items.length;i++){
  if(i)visit(a,i,tick());
  editDraft(a,i,answer(a.items[i].question),'id');
  await saveAttempt(a,submit(a,i,tick()),scope);
 }
 for(const e of finish(a,{now:tick()}))await saveAttempt(a,e,scope);
 await validateSnapshot(a,await listEvents(a.attempt_id,scope));
 validations.push(a.attempt_id);
 return a;
}
const core=shard.packages.find(p=>p.use==='mission_core');
const old=await complete(createAttempt(packages.get(core.package_id),scope,{mode:'practice',question_count:10,now:tick()}));
const attempts=[old];
const installed=shard.packages.find(p=>p.use==='mission_intro').package_id;
const missionResults=[];
for(const [i,kind] of ['intro','regular','regular'].entries()){
 const plan=planMission({shard,kind,policy:route.mission_policy,seen:exposure(attempts,nodeId),seed:101+i,available:new Set([installed])});
 const pkg=packages.get(plan.package.package_id);
 const items=plan.rows.map(r=>{
  const question=pkg.questions[r.index];
  const ref={package_id:pkg.package_id,content_version:pkg.content_version,package_sha256:plan.package.package_sha256,question_index:r.index,question_id:question.question_id,question_revision:question.question_revision};
  return {question,journey_role:r.role,journey_band:r.band,journey_review:r.review,occurrence_ref:ref};
 });
 const journey={journey_id:'kalibataku-adventure',node_id:nodeId,stage_id:node.stage_id,mission_kind:kind,metadata_version:route.metadata_version,route_version:route.route_version,policy_version:route.mission_policy.policy_version,seed:101+i,
 readiness_rule:{target_missions:2,min_rate:0.8,coverage_needed:Math.min(12,node.teaching_unique),strategies_needed:Math.min(2,node.teaching_strategies.length),label:'product_policy_not_psychometric'},
 selected_occurrence_refs:items.map(it=>it.occurrence_ref),selection_trace:plan.trace};
 const a=await complete(createAttempt(pkg,scope,{mode:'practice',items,journey,seed:101+i,now:tick()}));
 attempts.push(a);
 missionResults.push({kind,package_id:a.package_id,size:a.items.length,unique_new:plan.trace.unique_new,review:plan.trace.review,first_answers_correct:a.items.every(x=>x.history[0].is_correct)});
}
const state=journeyState(route,attempts,{stage_id:'S-G01-L01'}),s=state.nodes.get(nodeId);
const teacher=journeySummary(attempts).rows.find(r=>r.node_id===nodeId);
// Follow the teacher production pipeline through the actual report serializer.
// All four completed sessions belong to the same person and unfiltered period.
const person={id:profile.id,alias:'Audit fixture',classId:''};
const snapshot=buildSnapshot({person,people:[person],attempts,
 filters:{...initialFilters(),source:'local_practice',timezone:'UTC'},locale:'id',createdAt:new Date(tick()).toISOString()});
const bytes=await encode(snapshot,'json');
const exported=JSON.parse(new TextDecoder().decode(bytes));
const exportedTeacher=exported.journey.rows.find(r=>r.node_id===nodeId);
if(!exportedTeacher||snapshot.completed!==4||exported.completed!==4)throw new Error('REPORT_FIXTURE_NOT_COMPLETE');
const out={scope:'Fresh Node reproduction with production selector, engine, data validator and real source bank. Memory profile only; not a browser observation.',
scenario:'One completed non-journey practice from P002, then intro and two regular missions with only P001 available offline. All first responses correct.',
node_id:nodeId,old_practice:{package_id:old.package_id,size:old.items.length},missions:missionResults,valid_snapshots:validations.length,
student_state:{ready:s.ready,coverage:s.coverage,coverage_needed:s.coverage_needed,strategies_seen:s.strategies_seen,strategies_needed:s.strategies_needed,passing:s.passing.size,next:nextMission(route,state)},
teacher_report:{ready:teacher.ready,unique_seen:teacher.unique_seen,passing_missions:teacher.passing_missions,strategies_seen:teacher.strategies_seen,rule:teacher.rule},
exported_teacher_ready:exportedTeacher.ready,export_parse_success:true,
teacher_export:{pipeline:'buildSnapshot -> encode(JSON) -> JSON.parse',schema_version:exported.schema_version,
 completed_sessions:exported.completed,node_id:exportedTeacher.node_id,unique_seen:exportedTeacher.unique_seen,
 passing_missions:exportedTeacher.passing_missions,bytes:bytes.byteLength},
mismatch:s.ready!==teacher.ready,exported_mismatch:s.ready!==exportedTeacher.ready};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
if(!out.mismatch||!out.exported_mismatch)process.exitCode=2;
