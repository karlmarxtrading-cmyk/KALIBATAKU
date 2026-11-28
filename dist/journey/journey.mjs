import {compareInstants} from '../data/time.js';
// Journey I/O: loads the versioned route sidecar, verifies occurrence shards,
// records the start point and creates frozen mission attempts.
import {sha256} from '../data/common.js';
import {listAttempts,saveAttempt,activeScope,resolveActiveScope,scopeKey} from '../data/store.js';
import {transaction,key,row} from '../data/db.js';
// Player modules load only when a mission is created, never for home or map.
const player=()=>Promise.all([import('../player/engine.mjs'),import('../player/start.mjs')]).then(([e,s])=>({createAttempt:e.createAttempt,cells:s.cells,open:s.open}));
import {readShard} from '../core/bank.mjs';
const offlineTools=()=>import('./offline.mjs');
import {EXPOSURE_POLICY} from './exposure.mjs';
import {journeyState,nextMission,planMission,exposure,kindFor,JOURNEY_POLICY,REVIEW_POLICY} from './model.mjs';

const ROOT=new URL('../',import.meta.url);
import {originAvailable} from '../core/reachability.mjs';
export {originAvailable};
let routePromise;
const shards=new Map();
export function journeyURL(path){
  const u=new URL(path,ROOT);
  if(u.origin!==ROOT.origin||!u.pathname.startsWith(ROOT.pathname+'journey/v1/')||u.search||u.hash)throw new Error('JOURNEY_PATH');
  return u;
}
export function loadRoute(signal){
  routePromise??=fetch(journeyURL('journey/v1/route.json'),{signal}).then(async r=>{
    if(!r.ok)throw new Error('JOURNEY_LOAD');
    const route=await r.json();
    if(route.schema!=='kalibataku-journey-route/1'||!Array.isArray(route.nodes))throw new Error('JOURNEY_INVALID');
    route.byId=new Map(route.nodes.map(n=>[n.competency_id,n]));
    route.stageById=new Map(route.stages.map(s=>[s.stage_id,s]));
    return route;
  }).catch(e=>{routePromise=null;throw e;});
  return routePromise;
}
export async function loadShard(node,signal,refresh=false){
  if(!node?.occ)throw new Error('NO_MATERIAL');
  const key=node.occ.url+'#'+node.occ.sha256;
  if(!refresh&&shards.has(key))return shards.get(key);
  const r=await fetch(journeyURL(node.occ.url),refresh?{signal,cache:'no-store',headers:{'X-Kalibataku-Verify':'1'}}:{signal});
  if(!r.ok)throw Object.assign(new Error('JOURNEY_LOAD'),{code:'NOT_INSTALLED'});
  const bytes=await r.arrayBuffer();
  if(bytes.byteLength!==node.occ.bytes||await sha256(bytes)!==node.occ.sha256)throw new Error('CHECKSUM_MISMATCH');
  const shard=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(shard.competency_id!==node.competency_id)throw new Error('JOURNEY_INVALID');
  if(shards.size>6)shards.delete(shards.keys().next().value);
  shards.set(key,shard);
  return shard;
}
const stageIdPattern=/^S-G(0[1-9]|1[0-2])-L0[1-5]$/;
async function latestChoice(tx,ns){
  const records=await tx.prefix('records',key(ns,'journey-start|'));
  const choices=records.filter(r=>typeof r.data.id==='string'&&stageIdPattern.test(r.data.value?.stage_id)).map(r=>{
    const v=r.data.value;
    const revised=Number.isSafeInteger(v.revision)&&v.revision>0&&v.intent_id===r.data.id;
    return {...v,intent_id:r.data.id,revision:revised?v.revision:0};
  });
  // Old records only carried device time. New revisions are ordered across tabs
  // in one transaction. IDs break ties when two offline archives are merged.
  choices.sort((a,b)=>b.revision-a.revision||(!a.revision&&compareInstants(b.at,a.at))||b.intent_id.localeCompare(a.intent_id));
  return choices[0]||null;
}
export async function startPoint(scope){
  return transaction(['records'],false,tx=>latestChoice(tx,scopeKey(scope)));
}
export async function chooseStart(scope,stageId,method){
  if(!stageIdPattern.test(stageId))throw new Error('SELECTION');
  const ns=scopeKey(scope),id=crypto.randomUUID();
  return transaction(['records'],true,async tx=>{
    const previous=await latestChoice(tx,ns);
    const revision=(previous?.revision??0)+1;
    if(!Number.isSafeInteger(revision))throw new Error('INVALID_REVISION');
    const value={intent_id:id,revision,stage_id:stageId,method,at:new Date().toISOString(),policy_version:JOURNEY_POLICY};
    await tx.put('records',row(ns,'journey-start|'+id,{type:'journey-start',id,value}));
    return value;
  });
}
export async function overview(scope,signal){
  const [route,attempts,start]=await Promise.all([loadRoute(signal),listAttempts(scope),startPoint(scope)]);
  const state=journeyState(route,attempts,start);
  return {route,attempts,state,next:nextMission(route,state)};
}
const pending=new Map();
/**
 * Create a mission attempt for nodeId and return its id. A second call while the first
 * is still being created returns the same promise (double click, key repeat).
 */
export function createMission(ctx,{nodeId,kind}){
  const requestScope=ctx.scope||activeScope();
  const k=scopeKey(requestScope)+'|'+nodeId+'|'+kind;
  if(pending.has(k))return pending.get(k);
  const run=(async()=>{
    const scope=await resolveActiveScope();
    if(scopeKey(scope)!==scopeKey(requestScope))throw new Error('WRONG_PROFILE');
    const {route,attempts,state,next}=await overview(scope,ctx.signal);
    // One mission at a time: an ongoing mission is resumed, never duplicated.
    if(state.ongoing)return state.ongoing.attempt_id;
    const node=route.byId.get(nodeId);
    if(!node?.active)throw new Error('SELECTION');
    const s=state.nodes.get(nodeId);
    if(!s.unlocked)throw Object.assign(new Error('LOCKED_NODE'),{code:'LOCKED_NODE'});
    kind=['intro','regular','reinforcement','checkpoint','review'].includes(kind)?kind:kindFor(state,nodeId);
    const offline=!await originAvailable(ctx.signal);
    const seed=crypto.getRandomValues(new Uint32Array(1))[0];
    const selection={node,kind,policy:route.mission_policy,progress:s,seen:exposure(attempts,nodeId),seed};
    const offlineAPI=offline?await offlineTools():null;
    const cached=offlineAPI?await offlineAPI.missionCapability(await offlineAPI.missionInventory(ctx.signal),selection):null;
    if(cached&&cached.state!=='ready'){
      const code=cached.state==='repair'?'OFFLINE_REPAIR':'NOT_INSTALLED';
      throw Object.assign(new Error(code),{code});
    }
    const plan=cached?.plan||planMission({...selection,shard:await loadShard(node,ctx.signal)});
    const {createAttempt,cells,open}=await player();
    const cell=cached?.cell||(await cells(node.grade,node.level,ctx.signal)).find(c=>c.competency_id===nodeId);
    const entry=cached?.entry||cell?.packages.find(p=>p.package_id===plan.package.package_id);
    if(!entry||entry.sha256!==plan.package.package_sha256)throw new Error('JOURNEY_MISMATCH');
    const pkg=await open(entry,ctx.signal,cached?.bytes);
    const items=plan.rows.map(r=>{
      const question=pkg.questions[r.index];
      if(!question||String(question.fingerprint).slice(0,16)!==r.fp)throw new Error('JOURNEY_MISMATCH');
      return {question,journey_role:r.role,journey_band:r.band,journey_review:r.review,
        occurrence_ref:{package_id:pkg.package_id,content_version:pkg.content_version,package_sha256:entry.sha256,question_index:r.index,question_id:question.question_id,question_revision:question.question_revision}};
    });
    // Only a persisted mission at the selected destination consumes a pending
    // choice. Browsing, a failed load, or resuming an older session cannot do it.
    const followsChoice=state.start?.intent_id&&(!state.startPending||next.node_id===nodeId);
    const journey={journey_id:'kalibataku-adventure',node_id:nodeId,stage_id:node.stage_id,mission_kind:kind,
      ...(followsChoice?{start_intent_id:state.start.intent_id,start_intent_step:state.intentStep+1}:{}),
      metadata_version:route.metadata_version,route_version:route.route_version,policy_version:route.mission_policy.policy_version,
      journey_policy:JOURNEY_POLICY,exposure_policy:EXPOSURE_POLICY,feature_policy:route.feature_policy,seed,
      review_policy:REVIEW_POLICY.version,readiness_registry:state.registry_version,readiness_rule:{target_missions:s.rule.target_missions,min_rate:s.rule.min_rate,coverage_needed:s.coverage_needed,strategies_needed:s.strategies_needed,label:s.rule.label},
      selected_occurrence_refs:items.map(i=>i.occurrence_ref),selection_trace:plan.trace,created_at:new Date().toISOString()};
    if(scopeKey(await resolveActiveScope())!==scopeKey(scope))throw new Error('WRONG_PROFILE');
    const attempt=createAttempt(pkg,scope,{mode:'practice',lang:ctx.lang,items,journey,pool_size:cell.pool_size,seed});
    const saved=await saveAttempt(attempt,null,scope,{resumeOngoing:true});
    return saved.attempt_id;
  })();
  pending.set(k,run);
  run.finally(()=>pending.delete(k)).catch(()=>{});
  return run;
}
/**
 * Keep the next mission of a node playable offline: the package the selector would
 * choose now and the next candidate, each with the catalog shards and the node's
 * occurrence shard. Never the whole bank.
 */
export async function prepareOffline(ctx,nodeId,{onProgress}={}){
  const scope=await resolveActiveScope();
  const {route,attempts,state}=await overview(scope,ctx.signal);
  const node=route.byId.get(nodeId);if(!node?.active)throw new Error('SELECTION');
  if(!state.nodes.get(nodeId)?.unlocked)throw new Error('LOCKED_NODE');
  const {missionDependencies,missionInventory,missionCapability}=await offlineTools();
  const shard=await loadShard(node,ctx.signal,true);
  const next=nextMission(route,state);
  const kind=(next.node_id===nodeId&&next.kind)||kindFor(state,nodeId),seen=exposure(attempts,nodeId);
  const plan=planMission({shard,kind,policy:route.mission_policy,progress:state.nodes.get(nodeId),seen,seed:1});
  const ids=[plan.package.package_id,...plan.trace.candidates.map(c=>c.package_id).filter(id=>id!==plan.package.package_id)].slice(0,2);
  const index=await readShard('bank/index.json',ctx.signal),gref=index.grades.find(g=>g.grade===node.grade);
  const grade=await readShard(gref.url,ctx.signal),lref=grade.levels.find(l=>l.level===node.level);
  const level=await readShard(lref.url,ctx.signal);
  const cell=level.competencies.find(c=>c.competency_id===nodeId);
  const {installPackage}=await import('../data/offline.js');
  const done=[];
  for(const id of ids){
    const e=cell.packages.find(p=>p.package_id===id);
    const info={id:e.package_id,version:e.content_version,url:e.url,sha256:e.sha256,bytes:e.bytes,title:e.title,
      launch:'session/new?grade='+node.grade+'&level='+node.level+'&op='+node.operation+'&pack='+e.package_id,
      dependencies:missionDependencies(gref.url,lref.url,node)};
    done.push(await installPackage(info,{signal:ctx.signal,onProgress}));
  }
  const check=await missionCapability(await missionInventory(ctx.signal),{node,kind,policy:route.mission_policy,progress:state.nodes.get(nodeId),seen});
  if(check.state!=='ready')throw new Error('CACHE_INCOMPLETE');
  return {node_id:nodeId,packages:done.map(d=>d.id),bytes:done.reduce((s,d)=>s+(d.transfer_bytes||0),0)};
}
