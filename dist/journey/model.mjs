import {compareInstants} from '../data/time.js';
// KALIBATAKU adventure model (pure functions; no DOM, no storage).
// Mission selection, progress derivation and next-mission resolution.
// Difficulty data is an authored heuristic (see route.reviewer_status); readiness is a
// product policy, not a psychometric claim.
import {ruleFor,registryVersion} from './readiness-registry.mjs';
import {supportsJourneyVersion} from './versions.mjs';
import {itemWasViewed,EXPOSURE_POLICY} from './exposure.mjs';
export const JOURNEY_POLICY='journey-policy-1.1.0';
export const SELECTOR_VERSION='selector-1.1.0';
export const REVIEW_POLICY=Object.freeze({version:'spaced-review-1',days:7,missions:4});
export const XP_POLICY='xp-derived-1.0.0';
const ROLE_ORDER=['w','t','a'];
// Which material each mission kind may use, in order of preference.
export const KIND_USES={
  intro:['mission_intro','mission_core'],
  regular:['mission_core','mission_apply','mission_intro'],
  reinforcement:['mission_intro','mission_core'],
  checkpoint:['mission_review','mission_apply','mission_core'],
  review:['mission_review','mission_core','mission_apply','mission_intro']
};
// A score comes from the frozen AST feature vector. Equal mathematical scores
// have identical distances, even if the legacy fingerprint tertiles differ.
function roleTargets(rows,reinforce){
  const scores=[...new Set(rows.map(r=>r[3]))].sort((a,b)=>a-b);
  const middle=scores[Math.floor((scores.length-1)/2)];
  return {w:scores[0],t:reinforce?scores[0]:middle,a:reinforce?middle:scores.at(-1)};
}

export function lcg(seed){let s=seed>>>0;return()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}

export function missionShape(policy,kind){
  const base=kind==='intro'?policy.intro:kind==='checkpoint'?policy.checkpoint:policy.regular;
  return {size:base.size,roles:{...base.roles}};
}

// A response counts as independent only when it is the first response, correct, and
// neither the hint nor the key had been seen before it.
export function firstIndependent(item){
  const h=item.history?.[0];
  return !!h&&h.is_correct===true&&!(h.hint_before??h.hint_used)&&!h.key_seen_before;
}

/** Exposure of one competency from attempt snapshots. fp16 -> times seen. */
export function exposure(attempts,competencyId){
  const seen=new Map();
  for(const a of attempts){
    if(a.status==='abandoned'||(a.journey&&!supportsJourneyVersion(a.journey)))continue;
    for(const i of a.items||[]){
      if(i.question?.competency_id!==competencyId)continue;
      if(!itemWasViewed(i))continue;
      const k=String(i.question.fingerprint).slice(0,16);
      seen.set(k,(seen.get(k)||0)+1);
    }
  }
  return seen;
}

// Recovery material comes only from teaching packages. A formal A/B form is never
// eligible, even when it is the only installed package with a missing strategy.
const TEACHING_USES = KIND_USES.review;

function readinessGoal(kind, progress) {
  if (!progress || !['regular', 'reinforcement'].includes(kind) || progress.ready) return null;
  if (progress.strategies_seen < progress.strategies_needed) {
    return {reason:'missing_strategy', matches:r=>r[7].split('+').some(tag=>tag && (!progress.rule || progress.rule.strategies.includes(tag)) && !progress.strategies.has(tag))};
  }
  if (progress.coverage < progress.coverage_needed) {
    return {reason:'missing_coverage', matches:r=>!progress.seen.has(r[1])};
  }
  return null;
}

function compareKeys(a,b) {
  for (let i=0;i<a.length;i++) if (a[i]!==b[i]) return a[i]<b[i]?-1:1;
  return 0;
}

function chooseRow(rows,role,targetScore,used,seen,random,{matches=null,anyRole=false}={}) {
  let best=null, bestKey=null;
  for (const r of rows) {
    if (used.has(r[1]) || (!anyRole && !r[4].includes(role)) || (matches && !matches(r))) continue;
    // All pedagogical dimensions and prior exposure precede the seeded tie-break.
    // Same full role capabilities guarantee that drawing one tie cannot change
    // the remaining role quotas. Stable package choice fixes stage and purpose.
    const count=seen.get(r[1])||0;
    const key=[count>0?1:0,Math.abs(r[3]-targetScore),r[3],count,r[4],r[7],r[8],r[3],random.get(r),r[0]];
    if (!best || compareKeys(key,bestKey)<0) {best=r;bestKey=key;}
  }
  return best;
}

/**
 * Plan one frozen, single-package mission. 'progress' is the current node state
 * from journeyState, 'seen' the exposure counts and 'available' the installed
 * verified package IDs when offline. A regular/reinforcement mission reserves
 * one slot for a readiness deficit, including a teaching review if necessary.
 */
export function planMission({shard,kind,policy,seen=new Map(),progress=null,seed=1,available=null}){
  const shape=missionShape(policy,kind), uses=KIND_USES[kind]||KIND_USES.regular;
  const goal=readinessGoal(kind,progress);
  const eligible=shard.packages.filter(p=>!p.form_id && TEACHING_USES.includes(p.use) && p.q.length);
  const hasGoal=p=>!goal || p.q.some(goal.matches);
  const typical=eligible.filter(p=>uses.includes(p.use)&&hasGoal(p));
  // A fallback teaching purpose is allowed ONLY if the ordinary uses of this
  // kind cannot cover the current goal. Connectivity never changes that rule.
  const pool=typical.length || !goal ? typical : eligible.filter(hasGoal);
  const candidates=[];
  for (const p of pool) {
    if (available && !available.has(p.package_id)) continue;
    const unique=new Set(p.q.map(r=>r[1]));
    const unseen=[...unique].filter(k=>!seen.has(k)).length;
    const rank=uses.includes(p.use)?uses.indexOf(p.use):uses.length+TEACHING_USES.indexOf(p.use);
    candidates.push({p,unseen,unique:unique.size,rank});
  }
  if(!candidates.length) {
    const code=available?'NOT_INSTALLED':'NO_MATERIAL';
    throw Object.assign(new Error(code),{code});
  }
  const enough=c=>c.unseen>=shape.size;
  candidates.sort((x,y)=>(enough(y)-enough(x))||(enough(x)?x.rank-y.rank:y.unseen-x.unseen)||
    (y.unseen-x.unseen)||(x.rank-y.rank)||x.p.package_id.localeCompare(y.p.package_id));
  const chosen=candidates[0].p;
  const prefs=roleTargets(chosen.q,kind==='reinforcement');
  const rand=lcg(seed),random=new Map(chosen.q.map(r=>[r,rand()]));
  const picked=[],used=new Set(),reasons=new Set();
  const add=(r,role)=>{
    used.add(r[1]);
    picked.push({index:r[0],fp:r[1],band:r[2],score:r[3],roles:r[4],role,review:seen.has(r[1])});

  };
  if(goal){
    reasons.add(goal.reason);
    if(!uses.includes(chosen.use))reasons.add('teaching_purpose_fallback_for_readiness');
    // Regular and reinforcement have positive quotas for all three roles.
    for(const role of ['t','w','a']){
      if(!shape.roles[role])continue;
      const row=chooseRow(chosen.q,role,prefs[role],used,seen,random,{matches:goal.matches});
      if(row){add(row,role);break;}
    }
    if(!picked.length)throw new Error('UNREACHABLE_READINESS_GOAL');
  }
  for(const role of ROLE_ORDER){
    const remaining=(shape.roles[role]||0)-picked.filter(r=>r.role===role).length;
    for(let n=0;n<remaining;n++){
      const row=chooseRow(chosen.q,role,prefs[role],used,seen,random);
      if(!row)break;
      add(row,role);
    }
  }
  while(picked.length<shape.size){
    const row=chooseRow(chosen.q,'t',prefs.t,used,seen,random,{anyRole:true});
    if(!row)break;
    add(row,'t');reasons.add('role_quota_filled_from_target');
  }
  const reviewCount=picked.filter(x=>x.review).length;
  if(reviewCount)reasons.add(candidates[0].unseen?'role_or_package_has_limited_unseen':'pool_exhausted_review');
  if(picked.length<shape.size)reasons.add('package_smaller_than_mission');
  const rank={w:0,t:1,a:2};
  picked.sort((x,y)=>rank[x.role]-rank[y.role]||x.score-y.score||x.index-y.index);
  return {package:chosen,rows:picked,trace:{
    micro_policy:"score-distance-1",role_target_scores:prefs,selector_version:SELECTOR_VERSION,kind,seed,policy_version:policy.policy_version,
    candidates:candidates.slice(0,8).map(c=>({package_id:c.p.package_id,use:c.p.use,unseen:c.unseen,unique:c.unique})),
    candidate_count:candidates.length,chosen:chosen.package_id,
    unique_new:picked.length-reviewCount,review:reviewCount,size:picked.length,reasons:[...reasons],
    offline_filter:!!available}};
}

/** Result of one completed journey attempt. */
export function missionOutcome(a){
  const items=a.items||[];
  const target=items.filter(i=>i.journey_role==='t');
  const base=target.length?target:items;
  const independent=base.filter(firstIndependent).length;
  const firstIndep=items.filter(firstIndependent).length;
  const assisted=items.filter(i=>i.history?.some(h=>h.key_seen_before||(h.hint_before??h.hint_used))).length;
  const revisedAfterKey=items.filter(i=>i.history?.some(h=>h.key_seen_before)).length;
  return {attempt_id:a.attempt_id,kind:a.journey?.mission_kind,completed_at:a.completed_at,target_n:base.length,target_independent:independent,
    rate:base.length?independent/base.length:0,first_independent:firstIndep,viewed:items.filter(itemWasViewed).length,first_total:items.filter(i=>i.history?.length).length,n:items.length,assisted,revised_after_key:revisedAfterKey,
    final_correct:items.filter(i=>i.final_status==='correct').length};
}

/**
 * Derive the journey state. attempts: all attempt snapshots of the profile.
 * start: {stage_id} chosen by the learner, or null.
 */
export function journeyState(route,attempts,start=null){
  const policy=route.mission_policy;
  const byId=new Map(route.nodes.map(n=>[n.competency_id,n]));
  const stageOrder=new Map(route.stages.map(s=>[s.stage_id,s.order]));
  const startOrder=start?.stage_id&&stageOrder.has(start.stage_id)?stageOrder.get(start.stage_id):null;
  const nodes=new Map();
  for(const n of route.nodes)if(n.active)nodes.set(n.competency_id,{id:n.competency_id,rule:ruleFor(n,policy.policy_version),missions:[],passing:new Set(),ongoing:null,seen:new Set(),strategies:new Set(),last:null,checkpoint:false});
  let xp=0,journeyAttempts=0,ongoing=null;
  const rewarded=new Set();
  let intentStep=0,intentLastNode=null,legacyStagePlayed=false;
  const step=a=>start?.intent_id&&a.journey?.start_intent_id===start.intent_id&&Number.isSafeInteger(a.journey.start_intent_step)?a.journey.start_intent_step:0;
  const sorted=[...attempts].sort((x,y)=>step(x)-step(y)||compareInstants(x.completed_at||x.started_at,y.completed_at||y.started_at)||String(x.attempt_id).localeCompare(String(y.attempt_id)));
  for(const a of sorted){
    if(a.journey&&!supportsJourneyVersion(a.journey))continue;
    for(const i of a.items||[]){
      const s=nodes.get(i.question?.competency_id);
      // Readiness uses committed sessions. Partial exposures still guide mission selection.
      if(s&&a.status==='completed'&&itemWasViewed(i)){s.seen.add(String(i.question.fingerprint).slice(0,16));if(i.history?.length)for(const t of i.question.strategy_tags||[])s.strategies.add(t);}
    }
    if(!a.journey)continue;
    const s=nodes.get(a.journey.node_id);if(!s)continue;
    intentStep=Math.max(intentStep,step(a));
    if(a.status==='ongoing'){s.ongoing=a.attempt_id;ongoing??=a;if(compareInstants(a.started_at,ongoing.started_at)>0)ongoing=a;continue;}
    if(a.status!=='completed')continue;
    if(step(a)>0)intentLastNode=s.id;
    if(a.journey.stage_id===start?.stage_id)legacyStagePlayed=true;
    journeyAttempts++;
    const o=missionOutcome(a);s.missions.push(o);s.last=o;
    if(o.kind==='checkpoint')s.checkpoint=true;
    if(['regular','checkpoint','reinforcement'].includes(o.kind)&&o.target_n>0&&o.target_independent>=Math.ceil(o.target_n*s.rule.min_rate))s.passing.add(a.attempt_id);
    // XP is derived from distinct completed attempts, so reloads, replays and
    // double submissions cannot award it twice.
    if(!rewarded.has(a.attempt_id)){rewarded.add(a.attempt_id);xp+=5+10*o.first_independent;}
  }
  const out=new Map();
  for(const [id,s] of nodes){
    const n=byId.get(id);
    const need=s.rule.coverage_needed;
    const pool=new Set(s.rule.strategies),strategyNeed=s.rule.strategies_needed;
    const strategiesSeen=[...s.strategies].filter(t=>pool.has(t)).length;
    const isReady=s.passing.size>=s.rule.target_missions&&s.seen.size>=need&&strategiesSeen>=strategyNeed;
    out.set(id,{...s,node:n,coverage:s.seen.size,coverage_needed:need,strategies_seen:strategiesSeen,strategies_needed:strategyNeed,ready:isReady,
      reinforce:!!s.last&&!isReady&&s.last.rate<0.6});
  }
  for(const [id,s] of out){
    const n=s.node,stage=stageOrder.get(n.stage_id);
    const unmet=s.rule.prerequisites.filter(p=>!out.get(p)?.ready&&!(startOrder!==null&&stageOrder.get(byId.get(p).stage_id)<startOrder));
    s.unlocked=!unmet.length;s.stage_order=stage;
    s.unmet=unmet;
    s.status=s.ongoing?'playing':!s.unlocked?'locked':s.ready?'done':s.reinforce?'reinforce':'open';
  }
  const startPending=startOrder!==null&&!intentLastNode&&!!(start?.revision||!legacyStagePlayed);
  return {nodes:out,xp,journeyAttempts,ongoing,start,startOrder,startPending,intentStep,intentLastNode,policy:JOURNEY_POLICY,registry_version:registryVersion,exposure_policy:EXPOSURE_POLICY};
}

/** Decide the one next action. Returns {action,node_id?,kind?,reason,attempt_id?}. */
export function nextMission(route,state,now=Date.now()){
  if(state.ongoing)return {action:'continue',attempt_id:state.ongoing.attempt_id,node_id:state.ongoing.journey.node_id,reason:'ongoing_snapshot'};
  const order=route.order.filter(id=>state.nodes.has(id));
  const latest=state.nodes.get(state.intentLastNode)||[...state.nodes.values()].filter(s=>s.last).sort((x,y)=>lastTime(y)-lastTime(x)||x.id.localeCompare(y.id))[0];
  if(state.startPending){
    const selected=route.stages.find(st=>st.stage_id===state.start.stage_id);
    const open=selected.nodes.map(id=>state.nodes.get(id)).filter(s=>s?.unlocked);
    const node=open.find(s=>!s.ready)||open[0];
    if(node)return {action:'start',node_id:node.id,kind:kindFor(state,node.id),reason:'start_point'};
  }
  if(!latest&&state.startOrder===null)return {action:'choose_start',node_id:order.find(id=>state.nodes.get(id).unlocked),kind:'intro',reason:'no_history'};
  const firstOpen=()=>{
    const from=state.startOrder===null?0:order.findIndex(id=>state.nodes.get(id).stage_order>=state.startOrder);
    for(const id of order.slice(Math.max(0,from))){const s=state.nodes.get(id);if(s.unlocked&&!s.ready)return s;}
    for(const id of order){const s=state.nodes.get(id);if(s.unlocked&&!s.ready)return s;}
    return null;
  };
  if(!latest){
    const s=firstOpen();
    return s?{action:'start',node_id:s.id,kind:'intro',reason:'start_point'}:{action:'review',reason:'all_ready'};
  }
  if(!latest.ready){
    const kind=latest.reinforce?'reinforcement':'regular';
    return {action:latest.reinforce?'reinforce':'variation',node_id:latest.id,kind,
      reason:latest.reinforce?'last_mission_below_60_percent_independent':
        latest.strategies_seen<latest.strategies_needed?'practice_missing_strategy':
        latest.coverage<latest.coverage_needed?'expand_unique_coverage':'complete_passing_missions'};
  }
  // Ready: offer the stage checkpoint once, when every active node of the stage is ready.
  const stage=route.stages.find(st=>st.stage_id===latest.node.stage_id);
  const stageNodes=stage.nodes.filter(id=>state.nodes.has(id));
  const stageDone=stageNodes.every(id=>state.nodes.get(id).ready);
  const anchor=stageNodes.at(-1);
  if(stageDone&&!stageNodes.some(id=>state.nodes.get(id).checkpoint)&&latest.last.kind!=='checkpoint')
    return {action:'checkpoint',node_id:anchor,kind:'checkpoint',reason:'stage_complete'};
  const s=firstOpen();
  if(s){
    const history=[...state.nodes.values()].flatMap(n=>n.missions).sort((a,b)=>compareInstants(b.completed_at,a.completed_at));
    const recent=history.slice(0,REVIEW_POLICY.missions);
    if(recent.length===REVIEW_POLICY.missions&&recent.every(m=>m.kind!=='review')){
      const due=[...state.nodes.values()].filter(n=>n.ready&&n.unlocked&&n.id!==latest.id&&lastTime(n)>0&&now-lastTime(n)>=REVIEW_POLICY.days*86400000)
        .sort((a,b)=>lastTime(a)-lastTime(b)||a.id.localeCompare(b.id))[0];
      if(due)return {action:'review',node_id:due.id,kind:'review',reason:'spaced_review'};
    }
  }
  if(s)return {action:'advance',node_id:s.id,kind:s.missions.length?'regular':'intro',reason:'ready_to_advance'};
  // Everything open is ready: review the node practised longest ago.
  const oldest=[...state.nodes.values()].filter(x=>x.ready).sort((x,y)=>lastTime(x)-lastTime(y)||x.id.localeCompare(y.id))[0];
  return {action:'review',node_id:oldest?.id||latest.id,kind:'review',reason:'all_open_nodes_ready'};
}
const lastTime=s=>s.last?Date.parse(s.last.completed_at)||0:0;

/** Kind for an explicit node choice from the map. */
export function kindFor(state,nodeId){
  const s=state.nodes.get(nodeId);
  if(!s||!s.missions.length)return 'intro';
  if(s.ready)return 'review';
  return s.reinforce?'reinforcement':'regular';
}

/** The window of stages shown around the active stage on the map. */
export function stageWindow(route,activeStageId,radius=2){
  const i=route.stages.findIndex(s=>s.stage_id===activeStageId);
  const at=i<0?0:i;
  return route.stages.slice(Math.max(0,at-radius),at+radius+1);
}
