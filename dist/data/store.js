import {compareInstants} from './time.js';
import {VERSION,SAFE_ID,canonical,eventHash,scopeKey,now,invariant,fail} from './common.js';
import {transaction,key,row,getStatus} from './db.js';
import {ensureSummaries,pageSummaries,packageSet,forgetSummaries,syncSummary} from './summary.js';
import {validate} from './validate.js';
export {getStatus,scopeKey};
const DEVICE={origin:'local_practice',profileId:'local-default',environment:'device'};
const LEASE_MS=15000;
let OWNER=crypto.randomUUID();
let ownerReady;
const ownerKey='kalibataku.writer.v1';
// Browser sessionStorage can be copied into a duplicated tab. An exclusive Web
// Lock establishes that the prior document really released a reload candidate.
function ensureOwner(){
  if(ownerReady)return ownerReady;
  ownerReady=(async()=>{
    let previous, departing;
    try{
      previous=sessionStorage.getItem(ownerKey);
      departing=sessionStorage.getItem(ownerKey+'.departing');
      sessionStorage.removeItem(ownerKey+'.departing');
    }catch{}
    const reloading=globalThis.performance?.getEntriesByType('navigation')[0]?.type==='reload';
    const locks=globalThis.navigator?.locks;
    if(locks && globalThis.window){
      const take=(id,waiting)=>new Promise(resolve=>{
        let answered=false;
        const options=waiting?{signal:AbortSignal.timeout(750)}:{ifAvailable:true};
        locks.request('kalibataku:writer:'+id,options,lock=>{
          answered=true;resolve(!!lock);
          if(lock)return new Promise(release=>window.addEventListener('pagehide',release,{once:true}));
        }).catch(()=>{if(!answered)resolve(false);});
      });
      if(reloading && previous && SAFE_ID.test(previous) && await take(previous,true)) OWNER=previous;
      else await take(OWNER,false);
    }else if(reloading && previous && previous===departing && SAFE_ID.test(previous)){
      OWNER=previous;
    }
    try{sessionStorage.setItem(ownerKey,OWNER);}catch{}
    globalThis.window?.addEventListener('pagehide',()=>{
      try{sessionStorage.setItem(ownerKey+'.departing',OWNER);}catch{}
    },{once:true});
  })();
  return ownerReady;
}
const held=new Map();
let selected;
try{
  const previous=JSON.parse(sessionStorage.getItem('kalibataku.scope') || localStorage.getItem('kalibataku.localProfile') || 'null');
  if(previous){scopeKey(previous);selected=previous;}
}catch{}
export function activeScope(){return {...(selected??DEVICE)};}
export function selectScope(scope) {
  scopeKey(scope);selected={...scope};
  try{sessionStorage.setItem('kalibataku.scope',JSON.stringify(scope));
    if(scope.origin==='local_practice')localStorage.setItem('kalibataku.localProfile',JSON.stringify(scope));
  }catch{}
  globalThis.window?.dispatchEvent(new CustomEvent('kalibataku:profile',{detail:activeScope()}));return activeScope();
}
export const scopeForLocal=id=>({...DEVICE,profileId:id});
const removedKey='kalibataku.profile-removed';
function forgetRemoved(id,notify=true){
  if(!SAFE_ID.test(id))return;
  const current=activeScope();
  const matches=current.origin==='local_practice' && current.profileId===id;
  try{
    const preferred=JSON.parse(localStorage.getItem('kalibataku.localProfile')||'null');
    if(preferred?.origin==='local_practice'&&preferred.profileId===id)localStorage.removeItem('kalibataku.localProfile');
  }catch{}
  if(matches){
    selected={...DEVICE};
    try{sessionStorage.setItem('kalibataku.scope',JSON.stringify(selected));}catch{}
    globalThis.window?.dispatchEvent(new CustomEvent('kalibataku:profile',{detail:activeScope()}));
  }
  if(notify)globalThis.window?.dispatchEvent(new CustomEvent('kalibataku:profile-removed',{detail:{profileId:id}}));
}
// Write after the deletion transaction commits. Each open document validates
// its own active alias, and a closed/reloaded document revalidates it on entry.
globalThis.window?.addEventListener('storage',ev=>{
  if(ev.key===removedKey && ev.newValue){try{forgetRemoved(JSON.parse(ev.newValue).profileId);}catch{}}
});
export async function resolveActiveScope(){
  const current=activeScope();
  if(current.origin!=='local_practice'||current.profileId===DEVICE.profileId)return current;
  const stored=await transaction(['profiles'],false,tx=>tx.get('profiles',key('device',current.profileId)));
  if(scopeKey(activeScope())!==scopeKey(current))return resolveActiveScope();
  if(!stored)forgetRemoved(current.profileId);
  return activeScope();
}
export async function selectLocalProfile(id){
  const scope=scopeForLocal(id);
  if(id!==DEVICE.profileId){
    const found=await transaction(['profiles'],false,tx=>tx.get('profiles',key('device',id)));
    if(!found){forgetRemoved(id);return activeScope();}
  }
  return selectScope(scope);
}
export async function listProfiles() {
  const result=await transaction(['profiles'],true,async tx=>{
    if(!await tx.get('profiles',key('device',DEVICE.profileId))) await tx.put('profiles',row('device',DEVICE.profileId,{id:DEVICE.profileId,name:'',default:true}));
    return tx.all('profiles','device');
  });
  return result.map(r=>r.data);
}
export async function createProfile(name) {
  name=name.trim();invariant(name.length>0 && name.length<=80,'INVALID_PROFILE');
  const p={id:crypto.randomUUID(),name};
  await transaction(['profiles'],true,tx=>tx.put('profiles',row('device',p.id,p)));return p;
}
async function claim(tx,ns,id,takeover) {
  const k=key(ns,id);const current=await tx.get('leases',k);
  invariant(!current || current.data.owner===OWNER || current.data.expires<=Date.now() || takeover,'LOCKED');
  await tx.put('leases',row(ns,id,{owner:OWNER,expires:Date.now()+LEASE_MS}));
}
function hold(ns,id){
  const k=key(ns,id);if(held.has(k))return;
  const timer=setInterval(async()=>{
    try{const kept=await transaction(['leases'],true,async tx=>{
      const current=await tx.get('leases',k);
      if(current?.data.owner!==OWNER)return false;
      await tx.put('leases',row(ns,id,{owner:OWNER,expires:Date.now()+LEASE_MS}));return true;
    });if(!kept){clearInterval(timer);held.delete(k);}}
    catch{clearInterval(timer);held.delete(k);}
  },LEASE_MS/3);
  timer.unref?.();held.set(k,timer);
}
export async function acquireAttempt(id,scope=activeScope(),{takeover=false}={}) {
  await ensureOwner();invariant(SAFE_ID.test(id),'INVALID_ID');const ns=scopeKey(scope);
  await transaction(['leases'],true,tx=>claim(tx,ns,id,takeover));hold(ns,id);
}
export async function releaseAttempt(id,scope=activeScope()){
  const ns=scopeKey(scope),k=key(ns,id);clearInterval(held.get(k));held.delete(k);
  await transaction(['leases'],true,async tx=>{if((await tx.get('leases',k))?.data.owner===OWNER)await tx.del('leases',k);});
}
export async function getAttempt(id,scope=activeScope()){
  const rec=await transaction(['attempts'],false,tx=>tx.get('attempts',key(scopeKey(scope),id)));return rec?.data??null;
}
export async function listAttempts(scope=activeScope()){
  const list=await transaction(['attempts'],false,tx=>tx.all('attempts',scopeKey(scope)));
  return list.map(r=>r.data).sort((a,b)=>compareInstants(b.started_at,a.started_at)||a.attempt_id.localeCompare(b.attempt_id));
}
export async function queryAttemptSummaries(scope=activeScope(),options={}){
  const ns=scopeKey(scope);
  await transaction(['records','attempts','events'],true,tx=>ensureSummaries(tx,ns));
  return transaction(['records'],false,tx=>pageSummaries(tx,ns,options));
}
export async function usedPackages(scope=activeScope(),options={}){
  const ns=scopeKey(scope);
  await transaction(['records','attempts','events'],true,tx=>ensureSummaries(tx,ns));
  return transaction(['records'],false,tx=>packageSet(tx,ns,options));
}
export async function listEvents(attemptId,scope=activeScope()){
  const ns=scopeKey(scope);const events=await transaction(['events'],false,tx=>attemptId?tx.forAttempt(ns,attemptId):tx.all('events',ns));
  return events.map(r=>r.data).sort((a,b)=>a.attempt_id.localeCompare(b.attempt_id)||a.event_sequence-b.event_sequence);
}
export function provenance(scope) {
  return {data_origin:scope.origin,dataset_id:scope.environment,local_profile_id:scope.profileId,
    server_subject_ref:scope.origin==='lms_client'?scope.profileId:null};
}
async function envelope(input,seq,snapshot,scope) {
  // Retaining these fields on the caller's command makes a retry after a failed commit identical.
  input.event_id??=crypto.randomUUID();input.occurred_at_client??=now();
  const e={schema_version:VERSION,event_id:input.event_id,event_type:input.event_type,event_sequence:seq,
    attempt_id:snapshot.attempt_id,provenance:provenance(scope),context:input.context,
    occurred_at_client:input.occurred_at_client,payload:input.payload};
  e.payload_hash=await eventHash(e);return validate('Event',e);
}
export async function saveAttempt(snapshot,event=null,scope=activeScope(),{resumeOngoing=false}={}){
  await ensureOwner();
  const ns=scopeKey(scope),id=snapshot.attempt_id,k=key(ns,id),base=snapshot._rev??0,seq=snapshot._seq??0;
  invariant(typeof id==='string'&&SAFE_ID.test(id),'INVALID_ID');
  invariant(!snapshot.profile_id||scope.profileId===snapshot.profile_id,'WRONG_PROFILE');
  invariant(!snapshot.data_origin||scope.origin===snapshot.data_origin,'WRONG_PROFILE');
  const commands=event===null?[]:Array.isArray(event)?event:[event];
  const events=await Promise.all(commands.map((e,i)=>envelope(e,seq+i+1,snapshot,scope)));
  const tables=['attempts','events','leases','outbox','records',...(scope.origin==='local_practice'?['profiles']:[])];
  const result=await transaction(tables,true,async tx=>{
    const saved=(await tx.get('attempts',k))?.data;
    // Two tabs can finish loading the same recommendation before either tab has
    // saved it. Resolve this inside the same transaction as the first write.
    if(resumeOngoing&&!saved&&!base&&!events.length&&snapshot.journey){
      await ensureSummaries(tx,ns);
      const {rows}=await pageSummaries(tx,ns,{status:'ongoing',limit:1});
      if(rows.length)return (await tx.get('attempts',key(ns,rows[0].attempt_id))).data;
    }
    if(events.length) {
      const old=await Promise.all(events.map(e=>tx.get('events',key(ns,e.event_id))));
      if(old.some(Boolean)){
        invariant(saved && old.every((r,i)=>r && r.data.attempt_id===id && r.data.event_type===events[i].event_type &&
          r.data.occurred_at_client===events[i].occurred_at_client && canonical(r.data.context)===canonical(events[i].context) &&
          canonical(r.data.payload)===canonical(events[i].payload)),'EVENT_CONFLICT');
        return saved;
      }
      invariant(new Set(events.map(e=>e.event_id)).size===events.length,'EVENT_CONFLICT');
    }
    if(scope.origin==='local_practice'){
      const p=await tx.get('profiles',key('device',scope.profileId));
      if(!p){invariant(scope.profileId===DEVICE.profileId,'PROFILE_REMOVED');
        await tx.put('profiles',row('device',DEVICE.profileId,{id:DEVICE.profileId,name:'',default:true}));}
    }
    invariant((saved?._rev??0)===base && (saved?._seq??0)===seq,'STALE_REVISION');
    if(saved?.status==='completed')fail('FINALIZED');
    await claim(tx,ns,id,false);
    const latest={...snapshot,_rev:base+1,_seq:seq+events.length,_saved_at:now()};
    for(const e of events){
      await tx.put('events',row(ns,e.event_id,e));
      if(scope.origin!=='local_practice') await tx.put('outbox',row(ns,e.event_id,{
        event_id:e.event_id,attempt_id:id,event_sequence:e.event_sequence,payload_hash:e.payload_hash,
        state:'pending_sync',tries:0,next_at:0,grading_state:'unverified'
      }));
    }
    await tx.put('attempts',row(ns,id,latest));
    await syncSummary(tx,ns,latest,!saved,events.length,saved);
    return latest;
  });
  if(result.attempt_id!==id)return result;
  snapshot._rev=result._rev;snapshot._seq=result._seq;
  if(result._saved_at)snapshot._saved_at=result._saved_at;
  if(result.status==='completed'||result.status==='abandoned')await releaseAttempt(id,scope);else hold(ns,id);
  globalThis.window?.dispatchEvent(new CustomEvent('kalibataku:commit',{detail:{scope:{...scope},attemptId:id,events:events.length}}));
  return result;
}
export async function addRecord(type,id,data,scope=activeScope()){
  invariant(SAFE_ID.test(type)&&SAFE_ID.test(id),'INVALID_ID');const ns=scopeKey(scope);
  return transaction(['records'],true,async tx=>{
    const rec=row(ns,type+'|'+id,{type,id,value:data}),old=await tx.get('records',rec.key);
    if(old){invariant(canonical(old.data,false)===canonical(rec.data,false),'RECORD_CONFLICT');return data;}
    await tx.put('records',rec);return data;
  });
}
export async function listRecords(type,scope=activeScope(),{includeRecordId=false}={}){
  const all=await transaction(['records'],false,tx=>tx.all('records',scopeKey(scope)));
  return all.filter(r=>r.data.type===type).map(r=>includeRecordId?{...r.data.value,record_id:r.data.id}:r.data.value);
}
export async function profileImpact(id){
  const ns=scopeKey(scopeForLocal(id));
  return transaction(['attempts','events','records'],false,async tx=>{
    const [sessions,events,records]=await Promise.all(['attempts','events','records'].map(t=>tx.count(t,ns)));
    return {sessions,events,records};
  });
}
export async function deleteProfile(id,expected=null){
  invariant(SAFE_ID.test(id),'INVALID_PROFILE');const ns=scopeKey(scopeForLocal(id));
  const tables=['attempts','events','outbox','leases','records'];
  await transaction([...tables,'profiles'],true,async tx=>{
    if(expected){
      const counts=await Promise.all(['attempts','events','records'].map(t=>tx.count(t,ns)));
      invariant(counts.every((v,i)=>v===[expected.sessions,expected.events,expected.records][i]),'PROFILE_CHANGED');
    }
    for(const t of tables)await tx.scan(t,ns,r=>tx.del(t,r.key));
    await forgetSummaries(tx,ns);
    await tx.del('profiles',key('device',id));
    if(id===DEVICE.profileId)await tx.put('profiles',row('device',id,{id,name:'',default:true}));
  });
  forgetRemoved(id);
  try{localStorage.setItem(removedKey,JSON.stringify({profileId:id,change:crypto.randomUUID()}));}catch{}
}

// Resolve a remembered alias before callers can use it on first load.
await resolveActiveScope().catch(()=>{});
