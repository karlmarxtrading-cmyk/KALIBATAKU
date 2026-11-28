import {compareInstants} from './time.js';
import {scopeKey,VERSION,fail} from './common.js';
import {transaction,key} from './db.js';
import {activeScope} from './store.js';
import {LocalAdapter,MockAdapter,RemoteApiAdapter,errorState,backoff,correlate,receiptState} from './bridge.js';
export const adapterFor=(s,config={})=>s.origin==='demo'?new MockAdapter(s):s.origin==='lms_client'?new RemoteApiAdapter(s,config):new LocalAdapter(s);
export async function listOutbox(scope=activeScope()){
  return (await transaction(['outbox'],false,tx=>tx.all('outbox',scopeKey(scope)))).map(r=>r.data);
}
export function deliverySummary(entries){
  const sessions=new Map();
  for(const event of entries){
    if(!sessions.has(event.attempt_id))sessions.set(event.attempt_id,{attempt_id:event.attempt_id,total:0,accepted:0,states:{},last_ack:null,next_at:null,forbidden:false});
    const session=sessions.get(event.attempt_id);
    session.total++;
    session.states[event.state]=(session.states[event.state]||0)+1;
    if(['server_accepted','mock_accepted'].includes(event.state)){
      session.accepted++;
      if(event.received_at && (!session.last_ack||compareInstants(event.received_at,session.last_ack)>0))session.last_ack=event.received_at;
    }
    if(event.state==='retry_required'&&event.next_at && (!session.next_at||event.next_at<session.next_at))session.next_at=event.next_at;
    if(event.http_status===403)session.forbidden=true;
  }
  return sessions;
}
function due(row,current) {
  return row.state==='pending_sync' || row.state==='retry_required' && row.next_at<=current ||
    row.state==='sending' && row.lease_until<=current;
}
const sessions=new Map();
export async function syncPending(scope=activeScope(),options={}) {
  const ns=scopeKey(scope);
  if(scope.origin==='local_practice')return {sent:0,state:'saved_local'};
  if(sessions.has(ns))return sessions.get(ns);
  const running=sync(scope,ns,options).finally(()=>sessions.delete(ns));sessions.set(ns,running);return running;
}
async function sync(scope,ns,{adapter=adapterFor(scope),signal,getCurrentScope=activeScope,maxBatches=20}){
  if(adapter.origin==='server'&&!adapter.config?.apiBaseUrl)fail('BRIDGE_NOT_CONFIGURED');
  if(adapter.origin==='server' && scopeKey(getCurrentScope())!==ns)fail('SCOPE_CHANGED');
  const capabilities=await adapter.getCapabilities(signal);
  const cap=Math.min(100,capabilities.max_events||100),bytesCap=Math.min(262144,capabilities.max_bytes||262144);
  let sent=0,state='pending_sync';
  for(let b=0;b<maxBatches;b++){
    signal?.throwIfAborted();
    if(adapter.origin==='server' && scopeKey(getCurrentScope())!==ns)fail('SCOPE_CHANGED');
    const batchId=crypto.randomUUID(), stamp=Date.now();
    const batch=await transaction(['outbox','events'],true,async tx=>{
      const queue=(await tx.all('outbox',ns)).filter(r=>due(r.data,stamp))
        .sort((a,b)=>a.data.attempt_id.localeCompare(b.data.attempt_id)||a.data.event_sequence-b.data.event_sequence);
      if(!queue.length)return null;
      const attempt=queue[0].data.attempt_id;
      const packet={schema_version:VERSION,batch_id:batchId,attempt_id:attempt,events:[]};
      let size=new TextEncoder().encode(JSON.stringify(packet)).length;
      for(const r of queue) {
        if(r.data.attempt_id!==attempt || packet.events.length>=cap)break;
        const e=(await tx.get('events',key(ns,r.id)))?.data;
        if(!e)fail('MISSING_LEDGER');
        size+=new TextEncoder().encode(JSON.stringify(e)).length+1;
        if(size>bytesCap){
          if(!packet.events.length){r.data.state='rejected';r.data.error_code='BATCH_TOO_LARGE';await tx.put('outbox',r);}
          break;
        }
        packet.events.push(e);Object.assign(r.data,{state:'sending',lease_until:stamp+60000,send_token:batchId,tries:r.data.tries+1});
        await tx.put('outbox',r);
      }
      return packet.events.length?packet:null;
    });
    if(!batch)break;
    let ack,error,receivedAt;
    try{
      if(adapter.origin==='server')await adapter.getIdentity(signal);
      const ctx=batch.events[0].context;
      await adapter.startAttempt({attempt_id:batch.attempt_id,package_id:ctx.package_id,content_version:ctx.content_version,
        assignment_id:ctx.assignment_id,policy_version:ctx.policy_version},signal);
      if(adapter.origin==='server' && scopeKey(getCurrentScope())!==ns)fail('SCOPE_CHANGED');
      const receipt=await adapter.sendEventBatch(batch,{signal});
      ack=correlate(batch,receipt,adapter.origin);receivedAt=receipt.received_at;
      const end=batch.events.find(e=>e.event_type==='attempt.completed'&&['accepted','duplicate'].includes(ack.get(e.event_id)?.transport_result));
      if(end && !receipt.missing_sequences.length) {
        const completed=await adapter.completeAttempt({attempt_id:end.attempt_id,final_event_id:end.event_id,expected_event_count:end.payload.expected_event_count},signal);
        if(completed.status==='requires_missing_events')throw new Error('MISSING_SEQUENCES');
      }else if(end && receipt.missing_sequences.length){ack.delete(end.event_id);}
    }catch(e){error=e;}
    await transaction(['outbox'],true,async tx=>{
      for(const e of batch.events){
        const r=await tx.get('outbox',key(ns,e.event_id));if(r?.data.send_token!==batchId)continue;
        const a=ack?.get(e.event_id);
        const st=error?errorState(error):a?receiptState(a,adapter.origin):'pending_sync';
        Object.assign(r.data,{state:st,error_code:error?.code||error?.message||a?.error_code||null,
          next_at:st==='retry_required'?Date.now()+Math.ceil(backoff(r.data.tries,error||{})):0,
          receipt:a && !error?a:null,received_at:a&&!error?receivedAt:null,http_status:error?.status||null,lease_until:0,grading_state:'unverified'});
        delete r.data.send_token;await tx.put('outbox',r);
        state=st;if(st==='mock_accepted'||st==='server_accepted')sent++;
      }
    });
    if(error || !ack || ack.size!==batch.events.length || [...ack.values()].some(a=>!['accepted','duplicate'].includes(a.transport_result)))break;
  }
  return {sent,state};
}
let attached=false;
export function enableForegroundSync(){
  if(attached||!globalThis.window)return;attached=true;let timer;
  const schedule=(s=activeScope())=>{
    if(s.origin!=='demo')return;
    clearTimeout(timer);timer=setTimeout(()=>syncPending(s).catch(()=>{}),300);
  };
  window.addEventListener('online',()=>schedule());
  window.addEventListener('kalibataku:commit',e=>{if(e.detail.events)schedule(e.detail.scope);});
  window.addEventListener('kalibataku:profile',()=>schedule());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  setInterval(()=>{if(!document.hidden)schedule();},30000);
  schedule();
}
