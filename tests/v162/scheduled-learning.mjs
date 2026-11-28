import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root = new URL('../../', import.meta.url);
const oldRoot = new URL('./fixtures/legacy-1.5.1/', import.meta.url);
const out = resolve(process.argv[2]);
const load=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const M=await import(new URL('src/journey/model.mjs',root));
const E=await import(new URL('src/player/engine.mjs',root));
const {ruleFor}=await import(new URL('src/journey/readiness-registry.mjs',root));
const route=await load('src/journey/v1/route.json');
const materials=new Map(),nodes=new Map(route.nodes.map(n=>[n.competency_id,n]));
async function material(id){
 if(materials.has(id))return materials.get(id);
 const n=nodes.get(id),shard=await load('src/'+n.occ.url);
 const level=await load('dist/bank/g'+String(n.grade).padStart(2,'0')+'/l'+String(n.level).padStart(2,'0')+'.json');
 const refs=new Map(level.competencies.find(c=>c.competency_id===id).packages.map(p=>[p.package_id,p]));
 const v={shard,refs};materials.set(id,v);return v;
}
let serial=0;
async function mission(attempts,next,clock){
 const state=M.journeyState(route,attempts),s=state.nodes.get(next.node_id),n=s.node;
 const {shard,refs}=await material(next.node_id);
 const plan=M.planMission({shard,kind:next.kind,policy:route.mission_policy,progress:s,seen:M.exposure(attempts,next.node_id),seed:++serial*179});
 const ref=refs.get(plan.package.package_id),raw=await readFile(new URL('dist/'+ref.url,root));
 assert.equal(createHash('sha256').update(raw).digest('hex'),ref.sha256);
 const pkg=JSON.parse(raw.toString().slice(15).trim().replace(/;$/,''));
 assert(!pkg.form_id);
 const items=plan.rows.map(r=>{const q=pkg.questions[r.index];return{question:q,journey_role:r.role,journey_band:r.band,journey_review:r.review,occurrence_ref:{package_id:pkg.package_id,content_version:pkg.content_version,package_sha256:ref.sha256,question_index:r.index,question_id:q.question_id,question_revision:q.question_revision}};});
 const j={journey_id:'kalibataku-adventure',node_id:next.node_id,stage_id:n.stage_id,mission_kind:next.kind,
   metadata_version:route.metadata_version,route_version:route.route_version,policy_version:route.mission_policy.policy_version,
   journey_policy:M.JOURNEY_POLICY,feature_policy:route.feature_policy,seed:plan.trace.seed,
   readiness_registry:state.registry_version,review_policy:M.REVIEW_POLICY.version,
   readiness_rule:{target_missions:s.rule.target_missions,min_rate:s.rule.min_rate,coverage_needed:s.coverage_needed,strategies_needed:s.strategies_needed,label:s.rule.label},
   selected_occurrence_refs:items.map(x=>x.occurrence_ref),selection_trace:plan.trace,created_at:new Date(clock).toISOString()};
 const a=E.createAttempt(pkg,{profileId:'independent-learning-probe',origin:'local'},{mode:'practice',items,journey:j,seed:plan.trace.seed,now:clock});
 E.begin(a,++clock);
 for(let i=0;i<a.items.length;i++){
  if(i)E.visit(a,i,++clock);
  const ans=a.items[i].question.answer;
  E.editDraft(a,i,ans.denominator==='1'?ans.numerator:ans.numerator+'/'+ans.denominator);
  E.submit(a,i,++clock);
 }
 E.finish(a,{now:++clock});assert.equal(a.status,'completed');
 return a;
}
const output={runtime:process.version,started:new Date().toISOString(),checks:[],scenarios:[]};
// Every frozen rule equals the concrete old route contract, including all prerequisites.
for(const n of route.nodes.filter(n=>n.active)){
 const r=ruleFor(n,route.mission_policy.policy_version),p=route.mission_policy.readiness;
 assert.equal(r.coverage_needed,Math.min(p.coverage_min_unique,n.teaching_unique));
 assert.equal(r.strategies_needed,Math.min(p.strategy_min,n.teaching_strategies.length));
 assert.equal(r.target_missions,p.target_missions);assert.equal(r.min_rate,p.first_response_unassisted_min);
 assert.deepEqual(r.strategies,n.teaching_strategies);assert.deepEqual(r.prerequisites,n.prerequisites);
}
output.checks.push({name:'frozen-registry-all-281',status:'PASS',nodes:281});

// Actual bank, selector and player; one complete mission per 8 days exercises overdue review.
const attempts=[],trace=[];let clock=Date.UTC(2026,0,1),reviewCount=0,nonReviewSince=0;
for(let i=0;i<1600;i++){
 const state=M.journeyState(route,attempts);
 const next=M.nextMission(route,state,clock);
 if([...state.nodes.values()].filter(n=>n.ready).length===281 && next.reason==='all_open_nodes_ready'){
  const checkpoints=attempts.filter(a=>a.journey.mission_kind==='checkpoint').length;assert.equal(checkpoints,60);
  output.scenarios.push({name:'whole-route-one-mission-per-eight-days',status:'PASS',missions:attempts.length,review_missions:reviewCount,checkpoint_missions:checkpoints,ready_nodes:281,clock_simulated:true});break;
 }
 assert(next.node_id && state.nodes.get(next.node_id).unlocked);
 if(next.reason==='spaced_review'){
  assert(nonReviewSince>=4);
  assert.equal(next.kind,'review');assert(state.nodes.get(next.node_id).ready);
  assert(clock-Date.parse(state.nodes.get(next.node_id).last.completed_at)>=7*86400000);
  reviewCount++;nonReviewSince=0;
 }else nonReviewSince++;
 const a=await mission(attempts,next,clock);attempts.push(a);
 trace.push({mission:i+1,node:next.node_id,kind:next.kind,reason:next.reason,ready_before:[...state.nodes.values()].filter(s=>s.ready).length,completed_at:a.completed_at});
 clock+=8*86400000;
 if(i===1599)throw Error('route stalled with review');
}
assert(reviewCount>0);
output.trace=trace;

// Compare actual 1.5.1 and 1.6.0 derivations on serialized old/new histories.
const old=await import(new URL('src/journey/model.mjs',oldRoot));
const summary=s=>({xp:s.xp,nodes:[...s.nodes.values()].map(n=>({id:n.id,ready:n.ready,unlocked:n.unlocked,coverage:n.coverage,coverage_needed:n.coverage_needed,strategies_seen:n.strategies_seen,strategies_needed:n.strategies_needed,passing:n.passing.size}))});
for(const count of [0,1,5,40,200,attempts.length]){
 const hs=JSON.parse(JSON.stringify(attempts.slice(0,count)));
 assert.deepEqual(summary(M.journeyState(route,hs)),summary(old.journeyState(route,hs)));
}
output.checks.push({name:'old-new-derivation-six-real-history-prefixes',status:'PASS',history_sizes:[0,1,5,40,200,attempts.length]});
const expanded=structuredClone(route);
for(const n of expanded.nodes.filter(n=>n.active)){
 n.teaching_strategies.push('FUTURE-STRATEGY');n.teaching_unique+=100;
 n.prerequisites.push(route.order.at(-1));
}
Object.assign(expanded.mission_policy.readiness,{target_missions:100,first_response_unassisted_min:1,coverage_min_unique:100,strategy_min:99});
assert.deepEqual(summary(M.journeyState(expanded,JSON.parse(JSON.stringify(attempts)))),summary(M.journeyState(route,attempts)));
output.checks.push({name:'all-281-ready-retained-after-pool-prerequisite-threshold-mutation',status:'PASS'});
const reports=await import(new URL('src/journey/report.mjs',root));
const report=reports.journeySummary(attempts);
assert.equal(report.rows.filter(r=>r.ready).length,281);
for(const row of report.rows){const n=M.journeyState(route,attempts).nodes.get(row.node_id);assert.equal(row.unique_seen,n.coverage);assert.equal(row.passing_missions,n.passing.size);assert.equal(row.strategies_seen,n.strategies_seen);}
output.checks.push({name:'report-all-281-matches-map-for-long-review-history',status:'PASS'});
output.finished=new Date().toISOString();
const checks = [...output.checks, ...output.scenarios].map(row => ({
 id:row.name, status:row.status, expected:'Frozen readiness, justified review and route / report consistency',
 actual:row
}));
const build = await load('dist/build-info.json');
build.offline_release = (await load('dist/offline-assets.json')).release;
await mkdir(dirname(out), {recursive:true});
await writeFile(out, JSON.stringify({schema:'kalibataku-qa-receipt/1',suite:'scheduled-learning',
 scope:'Measured with the shipped local model and a synthetic clock eight days between missions.',
 build, started:output.started,finished:output.finished,runtime:{node:process.version},checks,
 status:'PASS',assertions:checks.length,trace:output.trace},null,2)+'\n');
console.log(checks.map(row => row.id).join('\n'));
