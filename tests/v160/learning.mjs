import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {journeyState,nextMission,missionOutcome,planMission} from '../../src/journey/model.mjs';
import {ruleFor} from '../../src/journey/readiness-registry.mjs';
const route=JSON.parse(await readFile('src/journey/v1/route.json'));
const node=route.nodes.find(n=>n.active),id=node.competency_id;
const shard=JSON.parse(await readFile('src/'+node.occ.url));
const initial=journeyState(route,[]),rule=ruleFor(node,route.mission_policy.policy_version);
const history=Array.from({length:6},(_,i)=>({attempt_id:'fixture-'+i,status:'completed',completed_at:new Date(Date.UTC(2025,0,1+i)).toISOString(),
  journey:{journey_id:'kalibataku-adventure',node_id:id,stage_id:node.stage_id,mission_kind:'regular',metadata_version:'1.0.0',
    policy_version:route.mission_policy.policy_version,route_version:route.route_version,selection_trace:{selector_version:'selector-1.1.0'}},
  items:Array.from({length:8},(_,j)=>({journey_role:j<4?'t':'w',viewed_at:'2025-01-01T00:00:00Z',
    question:{competency_id:id,fingerprint:(j+8*i).toString(16).padStart(16,'0'),strategy_tags:rule.strategies},
    history:[{is_correct:true}],final_status:'correct'}))}));
const base=journeyState(route,history),copy=structuredClone(route),edited=copy.nodes.find(n=>n.competency_id===id);
edited.teaching_strategies.push('NEW-EXTENSION');edited.teaching_unique+=100;edited.prerequisites.push(route.order.at(-1));
Object.assign(copy.mission_policy.readiness,{coverage_min_unique:100,strategy_min:99,target_missions:50,first_response_unassisted_min:1});
const expanded=journeyState(copy,JSON.parse(JSON.stringify(history)));
for(const k of ['ready','unlocked','coverage_needed','strategies_needed','strategies_seen'])assert.equal(expanded.nodes.get(id)[k],base.nodes.get(id)[k]);
assert(base.nodes.get(id).ready);
console.log('PASS F01 old profile stays ready with a changed pool, strategy, prerequisite and thresholds');
for(const target of [4,6,0]){
  const h=structuredClone(history[0]);h.items.forEach((it,j)=>{it.journey_role=j<target?'t':'w';it.history[0].is_correct=j!==0;});
  const o=missionOutcome(h),den=target||8;assert.equal(o.first_independent,7);assert.equal(o.target_n,den);assert.equal(o.target_independent,den-1);
  assert.equal(Math.ceil(rule.min_rate*den),({4:4,6:5,8:7})[den]);
  const s=journeyState(route,[h]).nodes.get(id);assert.equal(s.passing.size,den===4?0:1);
}
console.log('PASS PED-01 PED-02 independent target denominator 4, 6 and 8 fallback, including 7/8 vs 3/4');
const sh=planMission({shard,kind:'regular',policy:route.mission_policy,seed:42});
assert.equal(sh.trace.micro_policy,'score-distance-1');
const equal=new Set(shard.packages.filter(p=>!p.form_id).flatMap(p=>p.q.map(r=>r[3])));
assert.equal(equal.size,1);assert.equal(new Set(Object.values(sh.trace.role_target_scores)).size,1);
console.log('PASS PED-05 one mathematical score yields one difficulty target across legacy tertiles');
// Distinct old stop, most recent skill ready, and at least four intervening missions.
const other=route.order.find(n=>n!==id&&base.nodes.has(n)),old=base.nodes.get(other),recent=base.nodes.get(id);
Object.assign(old,{ready:true,unlocked:true,missions:[{...history[0],kind:'regular',completed_at:'2020-01-01T00:00:00Z'}]});old.last=old.missions[0];
recent.checkpoint=true;
assert.equal(nextMission(route,base,Date.UTC(2025,0,7)).reason,'spaced_review');
old.missions.push({...old.last,kind:'review',completed_at:'2025-01-07T00:00:00Z'});old.last=old.missions.at(-1);
assert.notEqual(nextMission(route,base,Date.UTC(2025,0,8)).reason,'spaced_review');
base.ongoing={attempt_id:'live',journey:{node_id:id}};assert.equal(nextMission(route,base).action,'continue');
console.log('PASS PED-06 review after seven days, four-mission spacing, active attempt first');
assert.equal(nextMission(route,initial).node_id,id);

const stageNodes=route.stages[0].nodes.filter(id=>initial.nodes.has(id));
const stageHistory=[];
for(const [index,stageId] of stageNodes.entries()){
  const contract=initial.nodes.get(stageId).rule;
  for(const [j,source] of history.entries()){
    const a=structuredClone(source);a.attempt_id='stage-'+index+'-'+j;a.journey.node_id=stageId;
    a.completed_at=new Date(Date.UTC(2026,0,1,0,index,j)).toISOString();
    for(const item of a.items){item.question.competency_id=stageId;item.question.strategy_tags=contract.strategies;}
    stageHistory.push(a);
  }
}
const now=Date.UTC(2026,0,2);
const checkpoint=nextMission(route,journeyState(route,stageHistory),now);assert.equal(checkpoint.kind,'checkpoint');
const close=structuredClone(stageHistory.at(-1));close.journey.mission_kind='checkpoint';close.attempt_id='anchor-zero';close.completed_at=new Date(now).toISOString();
close.items.push(...structuredClone(close.items.slice(0,2)));
for(const it of close.items){it.history=[{is_correct:false}];it.final_status='incorrect';}
const after=journeyState(route,[...stageHistory,close]);assert.equal(missionOutcome(close).first_independent,0);assert(after.nodes.get(checkpoint.node_id).ready);
assert.equal(nextMission(route,after,now).action,'advance');
console.log('PASS PED-07 zero of ten in a closing challenge preserves readiness earned before it');
