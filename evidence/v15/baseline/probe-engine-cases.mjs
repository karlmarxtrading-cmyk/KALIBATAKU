import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';
globalThis.crypto??=webcrypto;
if(!process.argv[2])throw new Error('Usage: node probe-engine-cases.mjs SOURCE_ROOT');
const root=path.resolve(process.argv[2]),out=path.dirname(fileURLToPath(import.meta.url));
const load=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const model=await import(pathToFileURL(path.join(root,'src/journey/model.mjs')));
const eng=await import(pathToFileURL(path.join(root,'src/player/engine.mjs')));
const route=await load('src/journey/v1/route.json'),byId=new Map(route.nodes.map(n=>[n.competency_id,n]));
const shardCache=new Map(),packCache=new Map();
const scope={profileId:'audit-synthetic-profile',origin:'local'};
let clock=Date.parse('2026-11-28T09:00:00Z');
const tick=()=>clock+=2000;
async function shard(id){if(!shardCache.has(id))shardCache.set(id,await load('src/journey/v1/occ/'+id+'.json'));return shardCache.get(id);}
async function pack(id){
 if(!packCache.has(id)){
  const [,g,l]=id.match(/^MM-G(\d\d)-L(\d\d)-/);
  const level=await load(`dist/bank/g${g}/l${l}.json`);
  const ref=level.competencies.flatMap(c=>c.packages).find(p=>p.package_id===id);
  const text=await fs.readFile(path.join(root,'dist',ref.url),'utf8');
  if(!text.startsWith('export default '))throw new Error('Unexpected package format');
  packCache.set(id,JSON.parse(text.slice('export default '.length).trim().replace(/;$/,'')));
 }return packCache.get(id);
}
const state=(attempts,start)=>model.journeyState(route,attempts,start);
async function play(id,kind,attempts,{seed=1,correct=true}={}){
 const node=byId.get(id),plan=model.planMission({shard:await shard(id),kind,policy:route.mission_policy,seen:model.exposure(attempts,id),seed});
 const pkg=await pack(plan.package.package_id);
 const items=plan.rows.map(r=>{const question=pkg.questions[r.index];return {question,journey_role:r.role,journey_band:r.band,journey_review:r.review,occurrence_ref:{package_id:pkg.package_id,content_version:pkg.content_version,package_sha256:plan.package.package_sha256,question_index:r.index,question_id:question.question_id,question_revision:question.question_revision}};});
 const journey={journey_id:'kalibataku-adventure',node_id:id,stage_id:node.stage_id,mission_kind:kind,metadata_version:route.metadata_version,route_version:route.route_version,policy_version:route.mission_policy.policy_version,seed,readiness_rule:{target_missions:2,min_rate:0.8,coverage_needed:Math.min(12,node.teaching_unique),strategies_needed:Math.min(2,node.teaching_strategies.length),label:'product_policy_not_psychometric'},selected_occurrence_refs:items.map(i=>i.occurrence_ref),selection_trace:plan.trace};
 const a=eng.createAttempt(pkg,scope,{mode:'practice',items,journey,seed,now:tick()});eng.begin(a,tick());
 for(let i=0;i<a.items.length;i++){
  eng.visit(a,i,tick());const ans=a.items[i].question.answer;
  const num=BigInt(ans.numerator)+(correct?0n:BigInt(ans.denominator));
  const text=ans.denominator==='1'?num.toString():num+'/'+ans.denominator;
  eng.editDraft(a,i,text,'id');eng.submit(a,i,tick());
 }
 eng.finish(a,{now:tick()});return a;
}
const first=await play('arithmetic.addition.g01.l01','intro',[],{correct:false});
const selectedStart={stage_id:'S-G05-L01'};
const startCase={control:model.nextMission(route,state([],selectedStart)),completed_attempt:{node:first.journey.node_id,status:first.status,items:first.items.length,correct:model.missionOutcome(first).first_independent},selectedStart,actual:model.nextMission(route,state([first],selectedStart))};

const start={stage_id:'S-G12-L01'},attempts=[];
const add='arithmetic.addition.g12.l01',mul='arithmetic.multiplication.g12.l01';
for(let i=0;i<12&&!state(attempts,start).nodes.get(add).ready;i++)attempts.push(await play(add,i?'regular':'intro',attempts,{seed:i+1}));
const before=state(attempts,start);
if(!before.nodes.get(mul).unlocked)throw new Error('Prerequisite preparation failed');
const missions=[];
for(let i=0;i<5;i++){
 const a=await play(mul,i?'regular':'intro',attempts,{seed:100+i});attempts.push(a);
 const s=state(attempts,start).nodes.get(mul);
 missions.push({kind:a.journey.mission_kind,package:a.package_id,items:a.items.length,first_independent:model.missionOutcome(a).first_independent,passing_missions:s.passing.size,unique_coverage:s.coverage,coverage_needed:s.coverage_needed,strategies:[...s.strategies],strategies_needed:s.strategies_needed,ready:s.ready,next:model.nextMission(route,state(attempts,start))});
}
const sh=await shard(mul),strategyCounts={};let rareRef=null;
for(const p of sh.packages){const count=strategyCounts[p.use]??={};for(const q of p.q){for(const t of q[7].split('+').filter(Boolean))count[t]=(count[t]||0)+1;if(q[7].includes('PO')){const pkg=await pack(p.package_id),question=pkg.questions[q[0]];rareRef={package:p.package_id,use:p.use,question_index:q[0],question_id:question.question_id,strategy_tags:question.strategy_tags,expression_ast:question.expression_ast};}}}
const result={method:'Node; real source model and engine; real bank questions; synthetic profile; no browser/storage UI claim',start_point_change:startCase,strategy_deadlock:{node:mul,prerequisite_ready:before.nodes.get(add).ready,target_unlocked_before_test:before.nodes.get(mul).unlocked,required_strategies:byId.get(mul).teaching_strategies,policy:route.mission_policy.readiness,strategy_counts_by_use:strategyCounts,only_PO:rareRef,missions,accessible_kinds_before_ready:['intro','regular','reinforcement'],kind_uses:model.KIND_USES,escape_boundary:'A manual catalogue session containing the review-only PO item can contribute strategy exposure; default adventure does not select that review material before readiness.'}};
await fs.writeFile(path.join(out,'engine-cases.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
