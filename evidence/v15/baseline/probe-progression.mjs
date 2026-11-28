import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw new Error('Usage: node probe-progression.mjs SOURCE_ROOT');
const out=path.dirname(fileURLToPath(import.meta.url));
const load=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const model=await import(pathToFileURL(path.join(root,'src/journey/model.mjs')));
const route=await load('src/journey/v1/route.json');
const byId=new Map(route.nodes.map(n=>[n.competency_id,n]));
const shards=new Map();
let mapped=0,packages=0,hashErrors=[],active=0;
const collisions=new Map();
for(const n of route.nodes.filter(n=>n.active)){
 active++;const bytes=await fs.readFile(path.join(root,'src',n.occ.url));
 const sha=createHash('sha256').update(bytes).digest('hex');
 if(sha!==n.occ.sha256||bytes.length!==n.occ.bytes)hashErrors.push(n.competency_id);
 const sh=JSON.parse(bytes);shards.set(n.competency_id,sh);
 for(const p of sh.packages){packages++;mapped+=p.q.length;}
}
const policy=route.mission_policy;
let tick=Date.parse('2026-11-28T00:00:00Z'),seq=0;
const state=(attempts,start=null)=>model.journeyState(route,attempts,start);
function completed(id,kind,attempts,{seed=++seq,correct=true,skipRoles=[]}={}){
 const sh=shards.get(id),n=byId.get(id),plan=model.planMission({shard:sh,kind,policy,seen:model.exposure(attempts,id),seed});
 const selected=plan.rows.map(r=>{
  const sourceRow=plan.package.q.find(q=>q[0]===r.index);
  const skipped=skipRoles.includes(r.role);
  return {question:{competency_id:id,fingerprint:r.fp,strategy_tags:sourceRow[7].split('+').filter(Boolean)},journey_role:r.role,journey_band:r.band,seen:!skipped,history:skipped?[]:[{is_correct:correct,hint_before:false,key_seen_before:false}],final_status:skipped?'unseen':correct?'correct':'incorrect'};
 });
 const at=new Date(tick+=10000).toISOString();
 return {attempt_id:'probe-'+(++seq),status:'completed',started_at:at,completed_at:at,journey:{node_id:id,stage_id:n.stage_id,mission_kind:kind},items:selected,probe_plan:plan};
}
// Reproduce changing the start point with and without a previous completed mission.
const firstId='arithmetic.addition.g01.l01';
const first=completed(firstId,'intro',[],{seed:1,correct:false});
const selectedStart={stage_id:'S-G05-L01'};
const control=model.nextMission(route,state([],selectedStart));
const actual=model.nextMission(route,state([first],selectedStart));
const startProbe={selected_start:selectedStart,without_history:control,with_finished_wrong_intro:actual,desired_start_is_unlocked:state([first],selectedStart).nodes.get('arithmetic.addition.g05.l01').unlocked};

// Exhaustive seed-policy shape survey over all active competencies, without browser.
const shapeDifferences=[];const introBand3=[];const crossRoleDescents=[];
const seeds=Array.from({length:12},(_,i)=>i+1);
for(const [id,shard] of shards){
 for(const kind of ['intro','regular','reinforcement','checkpoint','review']){
  const variants=new Map();
  for(const seed of seeds){
   const p=model.planMission({shard,kind,policy,seed});
   const signature=p.rows.map(r=>r.role+r.band).join(',');
   if(!variants.has(signature))variants.set(signature,{seed,package:p.package.package_id,signature,scores:p.rows.map(r=>r.score),reasons:p.trace.reasons});
   if(kind==='intro'&&p.rows.some(r=>r.band===3))introBand3.push({node:id,seed,package:p.package.package_id,signature,reasons:p.trace.reasons});
   const descending=p.rows.map((r,i)=>i>0&&(r.band<p.rows[i-1].band||r.score<p.rows[i-1].score)?i:null).filter(i=>i!==null);
   if(descending.length)crossRoleDescents.push({node:id,kind,seed,package:p.package.package_id,signature,scores:p.rows.map(r=>r.score),at:descending});
  }
  if(variants.size>1)shapeDifferences.push({node:id,kind,variants:[...variants.values()]});
 }
}

// Simulate the full default journey with every selected item answered correctly.
// Uses real selector/route/shards; minimal synthetic attempt records, not browser/engine.
const attempts=[];let blocked=null;const advances=[];const perNode={};
for(let step=0;step<1800;step++){
 const st=state(attempts,{stage_id:route.stages[0].stage_id});
 if([...st.nodes.values()].every(n=>n.ready))break;
 const next=model.nextMission(route,st);
 if(!next.node_id){blocked={step,next,why:'No node selected'};break;}
 const id=next.node_id;
 perNode[id]=(perNode[id]||0)+1;
 if(perNode[id]>25){blocked={step,next,why:'More than 25 perfect missions without moving past node',state:st.nodes.get(id)};break;}
 const a=completed(id,next.kind,attempts,{seed:1000+step});attempts.push(a);
 advances.push({step,id,kind:next.kind,package:a.probe_plan.package.package_id,unique_new:a.probe_plan.trace.unique_new});
}
const finishedState=state(attempts,{stage_id:route.stages[0].stage_id});
const perfectJourney={attempt_count:attempts.length,nodes_with_missions:Object.keys(perNode).length,ready:[...finishedState.nodes.values()].filter(s=>s.ready).length,total:active,blocked,per_node:perNode,sequence:advances};

const result={coverage:{active,packages,mapped,hashErrors},start_point:startProbe,shape_survey:{seeds,checked_node_kinds:active*5,varying_shapes:shapeDifferences.length,details:shapeDifferences,intro_with_band3_cases:introBand3.length,intro_with_band3_nodes:new Set(introBand3.map(x=>x.node)).size,intro_band3_examples:introBand3.slice(0,10),descents_across_roles_cases:crossRoleDescents.length,descent_examples:crossRoleDescents.slice(0,15)},perfect_journey:perfectJourney};
await fs.writeFile(path.join(out,'progression-probe.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({coverage:result.coverage,start_point:startProbe,shape_survey:{varying_shapes:shapeDifferences.length,intro_band3_nodes:result.shape_survey.intro_with_band3_nodes,descent_cases:crossRoleDescents.length,shape_examples:shapeDifferences.slice(0,3)},perfect_journey:{attempt_count:attempts.length,ready:perfectJourney.ready,total:active,blocked:blocked?.why||null}},null,2));
