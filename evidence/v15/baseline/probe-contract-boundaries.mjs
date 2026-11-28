// Portable audit probe. Uses production modules, synthetic local profiles and the
// Node memory adapter only. Does not change application source or existing data.
// node probe-contract-boundaries.mjs /absolute/source/root
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
if(!process.argv[2])throw new Error('Usage: node probe-contract-boundaries.mjs SOURCE_ROOT');
const root=resolve(process.argv[2]);
const mod=p=>import(pathToFileURL(join(root,p)).href);
const {createProfile,scopeForLocal,saveAttempt,listAttempts,deleteProfile}=await mod('src/data/store.js');
const {transaction,row}=await mod('src/data/db.js');
const {canonical,sha256,scopeKey}=await mod('src/data/common.js');
const {createAttempt,begin,visit,editDraft,submit,finish}=await mod('src/player/engine.mjs');
const {exportBackup,readBackup,exportArchive,readArchive,exportRecoveryBackup,previewBackup,importBackup}=await mod('src/data/backup.js');
const {planMission,journeyState,nextMission}=await mod('src/journey/model.mjs');
const {journeySummary}=await mod('src/journey/report.mjs');
const results={runtime:process.version,scope:'Local production functions in Node memory adapter; synthetic data; no browser or live user data',cases:[]};
const report=(id,x)=>{results.cases.push({id,...x});console.log(JSON.stringify({id,...x}));};
const attemptProfile=await createProfile('Audit journey contract');
const scope=scopeForLocal(attemptProfile.id);
const route=JSON.parse(await readFile(join(root,'src/journey/v1/route.json')));
const node=route.nodes.find(n=>n.competency_id==='arithmetic.addition.g03.l01');
const shard=JSON.parse(await readFile(join(root,'src/journey/v1/occ/'+node.competency_id+'.json')));
const plan=planMission({shard,kind:'regular',policy:route.mission_policy,seen:new Map(),seed:77});
const idx=JSON.parse(await readFile(join(root,'dist/bank/g03/l01.json')));
const entry=idx.competencies.flatMap(c=>c.packages).find(p=>p.package_id===plan.package.package_id);
const pkg=(await mod('dist/'+entry.url)).default;
const items=plan.rows.map(r=>{const question=pkg.questions[r.index];return {question,journey_role:r.role,journey_band:r.band,journey_review:r.review,occurrence_ref:{package_id:pkg.package_id,content_version:pkg.content_version,package_sha256:plan.package.package_sha256,question_index:r.index,question_id:question.question_id,question_revision:question.question_revision}};});
const journey={journey_id:'kalibataku-adventure',node_id:node.competency_id,stage_id:node.stage_id,mission_kind:'regular',metadata_version:route.metadata_version,route_version:route.route_version,policy_version:route.mission_policy.policy_version,seed:77,readiness_rule:{target_missions:2,min_rate:0.8,coverage_needed:Math.min(12,node.teaching_unique),strategies_needed:Math.min(2,node.teaching_strategies.length),label:'product_policy_not_psychometric'},selected_occurrence_refs:items.map(i=>i.occurrence_ref),selection_trace:plan.trace};
const attempt=createAttempt(pkg,scope,{mode:'practice',items,journey,seed:77});
await saveAttempt(attempt,null,scope);await saveAttempt(attempt,begin(attempt),scope);
for(let k=0;k<attempt.items.length;k++){
 visit(attempt,k);const q=attempt.items[k].question;editDraft(attempt,k,q.answer.denominator==='1'?q.answer.numerator:q.answer.numerator+'/'+q.answer.denominator,'id');await saveAttempt(attempt,submit(attempt,k),scope);
}
for(const ev of finish(attempt))await saveAttempt(attempt,ev,scope);
const baseline=await exportBackup(scope);await readBackup(baseline);
report('valid-journey-backup',{accepted:true,package:attempt.package_id,node:journey.node_id,items:attempt.items.length,
 teacher_ready:journeySummary([attempt]).rows[0].ready,map_ready:journeyState(route,[attempt]).nodes.get(journey.node_id).ready});
for(const [id,mutate] of [
 ['mismatched-node',a=>{a.journey.node_id='arithmetic.addition.g12.l05';a.journey.stage_id='S-G12-L05';}],
 ['invalid-occurrence-ref',a=>{a.items[0].occurrence_ref.question_index=999999;a.items[0].occurrence_ref.package_id='MM-G12-L05-ADD-P999';a.journey.selected_occurrence_refs[0]={...a.items[0].occurrence_ref};}],
 ['impossible-readiness-rule',a=>{a.journey.readiness_rule={target_missions:0,min_rate:-1,coverage_needed:-1,strategies_needed:-1};}],
 ['wrong-ref-list-length',a=>{a.journey.selected_occurrence_refs=[];}]
]){
 const b=structuredClone(baseline);mutate(b.records.attempts[0].data);const {checksum,...body}=b;b.checksum=await sha256(canonical(body,false));let error=null;
 try{await readBackup(b);}catch(e){error=e.code||e.message;}
 // Remove only this probe's in-memory synthetic profile. Restore goes through the
 // same validatedInput/compare transaction as the UI, with no existing conflicts.
 await deleteProfile(attemptProfile.id);
 const preview=await previewBackup(b),commit=await importBackup(b);
 const archive=await exportArchive(scope);await readArchive(archive);
 await deleteProfile(attemptProfile.id);const archiveCommit=await importBackup(archive);
 const restored=await listAttempts(scope),state=journeyState(route,restored),teacher=journeySummary(restored),j=restored[0].journey;
 report(id,{accepted:!error,error,json_preview_additions:preview.additions,json_restore_additions:commit.additions,
  zip_accepted:true,zip_restore_additions:archiveCommit.additions,restored_attempts:restored.length,
  unchanged_original_question:baseline.records.attempts[0].data.items[0].question.question_id,mutated_journey:j.node_id,
  restored_ref:restored[0].items[0].occurrence_ref,restored_selected_ref_count:j.selected_occurrence_refs.length,
  map_target_node_missions:state.nodes.get(j.node_id)?.missions.length,map_target_node_ready:state.nodes.get(j.node_id)?.ready,
  teacher_node:teacher.rows[0].node_id,teacher_material_grade:teacher.rows[0].grade,teacher_ready:teacher.rows[0].ready,
  next_mission:nextMission(route,state)});
}
// Documented legacy JSON row limit is 100,000, including attempts/events/records.
const legacyProfile=await createProfile('Audit JSON row boundary'),legacyScope=scopeForLocal(legacyProfile.id),ns=scopeKey(legacyScope);
await transaction(['records'],true,async tx=>{for(let i=0;i<100001;i++)await tx.put('records',row(ns,'audit|r'+i,{type:'audit',id:'r'+i,value:{n:i}}));});
let jsonData,error=null,exportError=null;
try{jsonData=await exportBackup(legacyScope);}catch(e){exportError=e.code||e.message;}
if(jsonData){try{await readBackup(jsonData);}catch(e){error=e.code||e.message;}}
report('legacy-json-row-limit',{rows:100001,exported:!!jsonData,exportError,bytes:jsonData?Buffer.byteLength(JSON.stringify(jsonData)):null,readAccepted:!!jsonData&&!error,readError:error});
const zip=await exportArchive(legacyScope),back=await readArchive(zip);
report('same-records-archive',{exported:true,bytes:zip.size,readAccepted:true,rows:back.records.records.length});
const draft=createAttempt(pkg,legacyScope,{mode:'practice',seed:78});
await saveAttempt(draft,null,legacyScope);await saveAttempt(draft,begin(draft),legacyScope);
let recovery=null,recoveryError=null;
try{recovery=await exportRecoveryBackup(legacyScope,draft);}catch(e){recoveryError=e.code||e.message;}
report('recovery-row-limit',{rows:100003,exported:!!recovery,error:recoveryError,format:recovery instanceof Blob?'archive':recovery?.format||null});
const out=new URL('./contract-boundaries.json',import.meta.url);await writeFile(out,JSON.stringify(results,null,2)+'\n');
