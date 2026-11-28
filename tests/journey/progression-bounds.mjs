// Run with node tests/journey/progression-bounds.mjs [receipt.json] from the project.
// Exhaust the real route, checking item-level provenance and independently tallying
// policy deficits. The synthetic learner submits canonical answers through the player.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {exposure,journeyState,nextMission,planMission,JOURNEY_POLICY} from '../../src/journey/model.mjs';
import {createAttempt,begin,visit,editDraft,submit,finish} from '../../src/player/engine.mjs';

const root=new URL('../../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const route=await read('src/journey/v1/route.json');
const policy=route.mission_policy, rule=policy.readiness;
const scope={profileId:'qa-perfect-path',origin:'local'};
const byId=new Map(route.nodes.map(n=>[n.competency_id,n]));
const caches=new Map();
async function materials(node){
  if(caches.has(node.competency_id))return caches.get(node.competency_id);
  const shard=await read('src/'+node.occ.url);
  const g=String(node.grade).padStart(2,'0'),l=String(node.level).padStart(2,'0');
  const level=await read('dist/bank/g'+g+'/l'+l+'.json');
  const packages=level.competencies.find(c=>c.competency_id===node.competency_id).packages;
  const data={shard,refs:new Map(packages.map(p=>[p.package_id,p]))};
  caches.set(node.competency_id,data);
  return data;
}
const reasons=new Map(),kindCounts={},allCases=[],universalBounds=new Map();
const kinds=['intro','regular','reinforcement','checkpoint','review'];
const allowed={
  intro:['introduce','consolidate'], regular:['consolidate','transfer','introduce'],
  reinforcement:['introduce','consolidate'],checkpoint:['review','transfer','consolidate'],
  review:['review','consolidate','transfer','introduce']
};
function checkPlan(node,plan,kind,refs,prior){
  const p=plan.package, ref=refs.get(p.package_id);
  assert.equal(ref.form_id,null);assert.notEqual(ref.purpose,'assessment');
  const fallback=plan.trace.reasons.includes('teaching_purpose_fallback_for_readiness');
  assert(allowed[kind].includes(ref.purpose) || (fallback && ['regular','reinforcement'].includes(kind)));
  assert.equal(ref.sha256,p.package_sha256);
  assert(plan.rows.length>0);
  assert.equal(new Set(plan.rows.map(r=>r.fp)).size,plan.rows.length);
  // Educational bucket signature. The seed can draw different fingerprints within
  // the same slot capabilities, domain, tags, score, band and exposure count.
  const signature=plan.rows.map(r=>{
    const row=p.q[r.index];
    assert.equal(row[1],r.fp); assert.equal(row[2],r.band);
    assert(row[4].includes(r.role)||plan.trace.reasons.includes('role_quota_filled_from_target'));
    return [p.package_id,r.role,r.score,row[4],row[7],row[8],prior.get(r.fp)||0].join('/');
  }).sort().join('|');
  for(const reason of plan.trace.reasons)reasons.set(reason,1+(reasons.get(reason)||0));
  return signature;
}

const started=new Date().toISOString();
for(const node of route.nodes.filter(n=>n.active)){
  const {shard,refs}=await materials(node);
  const allTeach=shard.packages.filter(p=>!refs.get(p.package_id).form_id && refs.get(p.package_id).purpose!=='assessment');
  const uniq=new Set(),tags=new Set();
  for(const p of allTeach)for(const row of p.q){
    uniq.add(row[1]);for(const tag of row[7].split('+').filter(Boolean))tags.add(tag);
  }
  assert.equal(uniq.size,node.teaching_unique);
  assert.deepEqual([...tags].sort(),[...node.teaching_strategies].sort());
  const intros=allTeach.filter(p=>allowed.intro.includes(refs.get(p.package_id).purpose));
  assert(intros.length);
  // Independent, prior-to-play bound for ANY seed on this node. Within a pack
  // the final fallback consumes every available distinct FP up to the shape size.
  // If all intro rows carry tags, any completed intro encounters at least one.
  const introMin=Math.min(policy.intro.size,...intros.map(p=>new Set(p.q.map(r=>r[1])).size));
  const minStrategies=intros.every(p=>p.q.every(row=>row[7].length))?1:0;
  const remaining=Math.max(0,Math.min(rule.coverage_min_unique,uniq.size)-introMin)+
    Math.max(0,Math.min(rule.strategy_min,tags.size)-minStrategies);
  universalBounds.set(node.competency_id,1+Math.max(rule.target_missions,remaining));
  // Include fresh, partly seen and fully exposed pools. All five kinds are
  // exercised at each node regardless of its position in the default route.
  const priorMaps=[new Map(),new Map([...uniq].filter((_,i)=>i%3===0).map(fp=>[fp,1])),
    new Map([...uniq].map((fp,i)=>[fp,1+(i%3)]))];
  for(const [phase,seen] of priorMaps.entries())for(const kind of kinds){
    const knownTags=new Set(phase===2?tags:[...tags].slice(0,phase));
    const progress={ready:false,seen:new Set(seen.keys()),coverage:seen.size,coverage_needed:Math.min(uniq.size,rule.coverage_min_unique),
      strategies:knownTags,strategies_seen:knownTags.size,strategies_needed:Math.min(tags.size,rule.strategy_min)};
    let reference=null;
    for(const seed of [1,127,987654321,4294967295]){
      const plan=planMission({shard,kind,policy,seen,progress,seed});
      const signature=checkPlan(node,plan,kind,refs,seen);
      if(reference===null)reference=signature;else assert.equal(signature,reference,node.competency_id+' '+kind+' phase '+phase);
      if(progress.strategies_seen<progress.strategies_needed && ['regular','reinforcement'].includes(kind)){
        assert(plan.rows.some(r=>plan.package.q[r.index][7].split('+').some(t=>t&&!knownTags.has(t))));
      }else if(progress.coverage<progress.coverage_needed && ['regular','reinforcement'].includes(kind)){
        assert(plan.rows.some(r=>!seen.has(r.fp)));
      }
      kindCounts[kind]=(kindCounts[kind]||0)+1;
    }
  }
}
// Force the distinct edge where the regular pool is exhausted, the review pool
// contains a new fingerprint, and a formal form also contains unseen items.
const microRow=(id,i,tags='DS')=>[i,id,2,10,'t',[],null,tags,'integer','fixture'];
const micro=(id,use,q,formal=false)=>({package_id:id,use,q,form_id:formal?'A':null});
const fixture={packages:[
  micro('ordinary','mission_core',[microRow('fp1',0)]),
  micro('review','mission_review',[microRow('fp1',0),microRow('fp2',1,'PO')]),
  micro('formal','assessment_form_reserved',[microRow('fp3',0,'PO')],true)
]};
const prior=new Map([['fp1',3],['fp2',1]]);
const base={seen:new Set(['fp1']),coverage:1,coverage_needed:2,
  strategies:new Set(['DS']),strategies_seen:1,strategies_needed:1,ready:false};
const edgeCases=[];
for(const strategies_needed of [1,2]){
  const progress={...base,strategies_needed};
  const input={shard:fixture,policy,kind:'regular',progress,seen:prior,seed:17};
  const p=planMission(input);
  assert.equal(p.package.package_id,'review');assert(p.rows.some(r=>r.fp==='fp2'));
  assert(p.trace.reasons.includes('teaching_purpose_fallback_for_readiness'));
  assert.throws(()=>planMission({...input,available:new Set(['ordinary','formal'])}),{code:'NOT_INSTALLED'});
  assert.equal(planMission({...input,available:new Set(['review'])}).package.package_id,'review');
  edgeCases.push({goal:strategies_needed===1?'coverage':'strategy',package:p.package.package_id,new_to_committed_coverage:'fp2',
    all_previously_exposed:p.rows.every(r=>r.review),excluded_partial_install:true});
}
let clock=Date.parse('2026-01-02T00:00:00Z');
const tick=()=>clock+=10;
const attempts=[],tallies=new Map(),rare='arithmetic.multiplication.g12.l01';
let checkpoints=0,answered=0,next,overall={};
while(true){
  const state=journeyState(route,attempts,null);
  next=nextMission(route,state,clock);
  if(next.action==='choose_start')next={kind:'intro',node_id:route.order.find(id=>state.nodes.get(id)?.unlocked)};
  if(next.kind==='review'){assert.equal([...state.nodes.values()].filter(s=>s.ready).length,281);break;}
  const {kind,node_id:id}=next, node=byId.get(id),progress=state.nodes.get(id);
  assert(progress.unlocked);
  for(const pre of node.prerequisites)assert(tallies.get(pre)?.ready,'prerequisite '+pre);
  const {shard,refs}=await materials(node);
  const prior=exposure(attempts,id);
  const plan=planMission({shard,kind,policy,progress,seen:prior,seed:(121933*(attempts.length+67))>>>0});
  checkPlan(node,plan,kind,refs,prior);
  const ref=refs.get(plan.package.package_id),raw=await readFile(new URL('dist/'+ref.url,root));
  assert.equal(createHash('sha256').update(raw).digest('hex'),ref.sha256);
  const pkg=JSON.parse(raw.toString().slice('export default '.length).trim().replace(/;$/,''));
  const items=plan.rows.map(r=>{
    const q=pkg.questions[r.index];
    assert.equal(q.competency_id,id);assert.equal(q.fingerprint.slice(0,16),r.fp);
    return {question:q,journey_role:r.role,journey_band:r.band,journey_review:r.review,occurrence_ref:{
      package_id:pkg.package_id,package_sha256:ref.sha256,content_version:pkg.content_version,
      question_index:r.index,question_id:q.question_id,question_revision:q.question_revision}};
  });
  const tNeed=Math.min(rule.strategy_min,node.teaching_strategies.length),cNeed=Math.min(rule.coverage_min_unique,node.teaching_unique);
  const journey={journey_id:'kalibataku-adventure',node_id:id,stage_id:node.stage_id,mission_kind:kind,
    metadata_version:route.metadata_version,route_version:route.route_version,policy_version:policy.policy_version,
    journey_policy:JOURNEY_POLICY,feature_policy:route.feature_policy,seed:plan.trace.seed,
    readiness_rule:{target_missions:rule.target_missions,min_rate:rule.first_response_unassisted_min,coverage_needed:cNeed,strategies_needed:tNeed,label:rule.label},
    selected_occurrence_refs:items.map(r=>r.occurrence_ref),selection_trace:plan.trace,created_at:new Date(clock).toISOString()};
  const a=createAttempt(pkg,scope,{mode:'practice',items,journey,seed:plan.trace.seed,now:tick()});
  begin(a,tick());
  for(let j=0;j<a.items.length;j++){
    if(j)visit(a,j,tick());
    const ans=a.items[j].question.answer;
    editDraft(a,j,ans.denominator==='1'?ans.numerator:ans.numerator+'/'+ans.denominator);
    submit(a,j,tick());assert.equal(a.items[j].history[0].is_correct,true);
    answered++;
  }
  finish(a,{now:tick()});assert.equal(a.status,'completed');attempts.push(a);
  if(kind==='checkpoint'){assert(progress.ready);checkpoints++;continue;}
  const track=tallies.get(id)||{id,n:0,bound:0,fp:new Set(),tags:new Set(),passing:0,history:[]};
  assert(!track.ready,'post-ready practice loop: '+id);
  const deficit=()=>Math.max(0,cNeed-track.fp.size)+Math.max(0,tNeed-track.tags.size)+Math.max(0,rule.target_missions-track.passing);
  const was=deficit();track.n++;
  for(const it of a.items){track.fp.add(it.question.fingerprint);for(const t of it.question.strategy_tags)track.tags.add(t);}
  if(kind==='regular'||kind==='reinforcement'){
    assert(items.some(i=>i.journey_role==='t'),'missing target answers for '+id);track.passing++;
  }
  const now=deficit();
  if(kind==='intro'){
    assert.equal(track.n,1);
    track.bound=1+Math.max(rule.target_missions,Math.max(0,tNeed-track.tags.size)+Math.max(0,cNeed-track.fp.size));
  }else{
    assert(now<was,'no progress at '+id);
    if(progress.strategies_seen<progress.strategies_needed)assert(track.tags.size>progress.strategies_seen);
    else if(progress.coverage<progress.coverage_needed)assert(track.fp.size>progress.coverage);
  }
  track.history.push({kind,package_id:pkg.package_id,reasons:plan.trace.reasons,
    passing:track.passing,unique:track.fp.size,strategies:[...track.tags].sort(),
    ...(id===rare?{question_indices:plan.rows.map(r=>r.index)}:{})});
  track.ready=now===0;
  assert(track.n<=track.bound && track.bound<=universalBounds.get(id),'exceeded bound at '+id);
  tallies.set(id,track);
  if(track.ready)allCases.push({node:id,missions:track.n,bound:track.bound,seed_independent_bound:universalBounds.get(id),coverage:track.fp.size,strategies:[...track.tags].sort(),passing:track.passing});
  assert(attempts.length<=281*(1+rule.strategy_min+rule.coverage_min_unique+rule.target_missions)+60);
}
assert.equal(tallies.size,281);assert.equal(checkpoints,60);
const rareHistory=tallies.get(rare).history;
assert(rareHistory.some(m=>m.package_id==='MM-G12-L01-MUL-P017' && m.question_indices.includes(16) && m.reasons.includes('teaching_purpose_fallback_for_readiness')));
overall={status:'PASS',command:'node tests/journey/progression-bounds.mjs',node:process.version,started_at:started,finished_at:new Date().toISOString(),
  environment:'Node; real question bank, real selector, resolver and player engine; synthetic perfect responses',
  route:route.route_version,policy:policy.policy_version,full_route:{nodes:tallies.size,checkpoint_missions:checkpoints,
    practice_missions:attempts.length-checkpoints,submitted_answers:answered,final_action:next,
    max_observed:Math.max(...allCases.map(c=>c.missions)),max_bound_after_intro:Math.max(...allCases.map(c=>c.bound)),max_seed_independent_bound:Math.max(...universalBounds.values())},
  buckets:{fresh_partial_full:3,seeds_per_state:4,kindCounts,reasons:Object.fromEntries(reasons)},
  g12l01mul:rareHistory,edge_cases:edgeCases,nodes:allCases};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(overall,null,2)+'\n');
console.log(JSON.stringify({status:overall.status,full_route:overall.full_route,kindCounts},null,2));
