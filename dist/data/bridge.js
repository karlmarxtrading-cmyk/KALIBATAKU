import {VERSION,canonical,eventHash,scopeKey,now,invariant,fail,SAFE_ID} from './common.js';
import {validate} from './validate.js';
import {transaction,key,row} from './db.js';
import {listAttempts,listRecords} from './store.js';
export function transportError(status,code,retryAfter=0) {
  const e=new Error(code||('HTTP_'+status));
  Object.assign(e,{code:e.message,status,retryAfter});return e;
}
export function errorState(error) {
  if(error.status===401)return 'auth_required';
  if(error.status===409)return 'conflict';
  if(error.status===429 || error.status>=500 || !error.status && !['BRIDGE_NOT_CONFIGURED','UNSUPPORTED_SCHEMA','SCOPE_CHANGED','INVALID_BATCH'].includes(error.code)) return 'retry_required';
  return 'rejected';
}
export function backoff(tries,error,random=Math.random) {
  return Math.max(error.retryAfter||0,Math.min(300000,1000*2**Math.min(tries,8))*(0.75+random()*0.5));
}
function allowedScope(event,scope) {
  return event.provenance.data_origin===scope.origin && event.provenance.local_profile_id===scope.profileId &&
    event.provenance.dataset_id===scope.environment &&
    (scope.origin!=='lms_client'||event.provenance.server_subject_ref===scope.profileId);
}
export async function checkBatch(batch,scope) {
  if(!batch || batch.schema_version!==VERSION)throw transportError(422,'UNSUPPORTED_SCHEMA');
  invariant(SAFE_ID.test(batch.batch_id)&&SAFE_ID.test(batch.attempt_id) && Array.isArray(batch.events)&&batch.events.length>0&&batch.events.length<=100,'INVALID_BATCH');
  if(new TextEncoder().encode(JSON.stringify(batch)).length>262144)throw transportError(422,'BATCH_TOO_LARGE');
  const ids=new Set();
  for(const e of batch.events){
    if(e.schema_version!==VERSION)throw transportError(422,'UNSUPPORTED_SCHEMA');
    try{validate('Event',e);}catch{throw transportError(422,'INVALID_EVENT');}
    if(e.attempt_id!==batch.attempt_id || !allowedScope(e,scope)) throw transportError(403,'SCOPE_MISMATCH');
    if(await eventHash(e)!==e.payload_hash||ids.has(e.event_id)) throw transportError(422,'INVALID_HASH_OR_DUPLICATE');
    ids.add(e.event_id);
  }
}
export function correlate(batch,receipt,origin) {
  try{validate('BatchReceipt',receipt);}catch{fail('MALFORMED_ACK');}
  invariant(receipt.receipt_origin===origin && receipt.batch_id===batch.batch_id && receipt.attempt_id===batch.attempt_id,'MISMATCHED_ACK');
  const sent=new Map(batch.events.map(e=>[e.event_id,e.payload_hash])),ack=new Map();
  for(const r of receipt.receipts){
    invariant(sent.get(r.event_id)===r.payload_hash&&!ack.has(r.event_id),'MISMATCHED_ACK');
    ack.set(r.event_id,r);
  }
  return ack;
}
export function receiptState(r,origin) {
  if(['accepted','duplicate'].includes(r.transport_result))return origin==='mock'?'mock_accepted':'server_accepted';
  return r.transport_result;
}
const CAPS={schema_versions:[VERSION],max_events:100,max_bytes:262144,features:['event_batch','partial_ack','progress','reports']};
export class LocalAdapter {
  constructor(scope){this.scope=scope;this.origin='local';}
  async getCapabilities(){return {...CAPS,environment_id:this.scope.environment,transport:false};}
  async getIdentity(){return {subject:this.scope.profileId,environment_id:this.scope.environment,data_origin:this.scope.origin,roles:['learner']};}
  async listAssignments(){return {items:await listRecords('assignment',this.scope),next_cursor:null};}
  async startAttempt(binding){return {...binding,data_origin:this.scope.origin,grading_state:'unverified'};}
  async sendEventBatch(){fail('LOCAL_ONLY');}
  async completeAttempt({attempt_id}){return {attempt_id,grading_state:'unverified'};}
  async getProgress(){return {items:await listAttempts(this.scope),data_origin:this.scope.origin,grading_state:'unverified'};}
  async requestReport(){return {...await this.getProgress(),created_at:now()};}
}
function missing(sequences,n){
  const gaps=[];for(let i=1;i<=n;i++)if(!sequences.has(i))gaps.push(i);
  return gaps;
}
export class MockAdapter extends LocalAdapter {
  constructor(scope,options={}){super(scope);invariant(scope.origin==='demo','INVALID_SCOPE');this.origin='mock';this.options=options;}
  async getCapabilities(){return {...CAPS,environment_id:this.scope.environment,auth:'synthetic',server_time:now()};}
  async listAssignments(){
    const all=await listRecords('assignment',{...this.scope,profileId:'demo-staff'});
    return {items:all.filter(a=>a.profileId===this.scope.profileId || a.student_id===this.scope.profileId || a.profile_id===this.scope.profileId || a.student_ids?.includes(this.scope.profileId)),next_cursor:null};
  }
  async startAttempt(binding) {
    invariant(SAFE_ID.test(binding.attempt_id),'INVALID_ID');
    const ns=scopeKey(this.scope);
    return transaction(['mockBindings'],true,async tx=>{
      const entry=row(ns,binding.attempt_id,binding),old=await tx.get('mockBindings',entry.key);
      if(old && canonical(old.data)!==canonical(binding))throw transportError(409,'BINDING_CONFLICT');
      if(!old)await tx.put('mockBindings',entry);
      return {...binding,receipt_origin:'mock',grading_state:'unverified'};
    });
  }
  async sendEventBatch(batch,{signal}={}){
    await checkBatch(batch,this.scope);signal?.throwIfAborted();
    const opt=this.options;
    if(opt.latency)await new Promise(r=>setTimeout(r,opt.latency));
    signal?.throwIfAborted();
    if(opt.status)throw transportError(opt.status,'MOCK_HTTP_'+opt.status,opt.retryAfter);
    const ns=scopeKey(this.scope);
    const ack=await transaction(['mockInbox','mockBindings'],true,async tx=>{
      const binding=(await tx.get('mockBindings',key(ns,batch.attempt_id)))?.data;
      if(!binding)throw transportError(409,'BIND_FIRST');
      const prior=(await tx.all('mockInbox',ns)).map(r=>r.data);
      const sequence=new Map(prior.filter(e=>e.attempt_id===batch.attempt_id).map(e=>[e.event_sequence,e]));
      const receipts=[];
      for(const e of batch.events.slice(0,opt.partial??batch.events.length)){
        const old=await tx.get('mockInbox',key(ns,e.event_id));
        let result='accepted',reason=null;
        if(old) {
          result=old.data.payload_hash===e.payload_hash?'duplicate':'conflict';
          if(result==='conflict')reason='EVENT_CONFLICT';
        }else if(sequence.has(e.event_sequence)){
          result='conflict';reason='SEQUENCE_CONFLICT';
        }else if(binding.content_version!==e.context.content_version || binding.package_id!==e.context.package_id){
          result='rejected';reason='VERSION_MISMATCH';
        }else if(binding.deadline && Date.now()>Date.parse(binding.deadline)){
          result='rejected';reason='DEADLINE_PASSED';
        }else if(e.event_sequence>100000){
          result='rejected';reason='SEQUENCE_TOO_LARGE';
        }else{
          await tx.put('mockInbox',row(ns,e.event_id,e));sequence.set(e.event_sequence,e);
        }
        receipts.push({event_id:e.event_id,payload_hash:e.payload_hash,transport_result:result,grading_state:'unverified',error_code:reason});
      }
      const max=Math.max(0,...sequence.keys());
      return {schema_version:VERSION,receipt_origin:'mock',attempt_id:batch.attempt_id,batch_id:batch.batch_id,
        received_at:now(),receipts,missing_sequences:missing(sequence,max)};
    });
    if(opt.timeoutAfterCommit){opt.timeoutAfterCommit=false;throw transportError(0,'TIMEOUT_AFTER_COMMIT');}
    return ack;
  }
  async completeAttempt({attempt_id,expected_event_count,final_event_id}){
    invariant(Number.isInteger(expected_event_count)&&expected_event_count>0&&expected_event_count<=100000,'INVALID_COUNT');
    const ns=scopeKey(this.scope);
    const inbox=(await transaction(['mockInbox'],false,tx=>tx.all('mockInbox',ns))).map(r=>r.data).filter(e=>e.attempt_id===attempt_id);
    const seq=new Map(inbox.map(e=>[e.event_sequence,e])), gaps=missing(seq,expected_event_count);
    if(gaps.length)return {attempt_id,status:'requires_missing_events',missing_sequences:gaps,grading_state:'unverified'};
    const end=seq.get(expected_event_count),start=seq.get(1);
    if(start.event_type!=='attempt.started' || end.event_type!=='attempt.completed' || end.event_id!==final_event_id ||
      end.payload.expected_event_count!==expected_event_count)throw transportError(422,'INVALID_FINALIZATION');
    const expected=new Map(start.payload.instances.map(i=>[i.question_instance_id,i]));
    const byId=new Map(inbox.map(e=>[e.event_id,e]));
    for(const f of end.payload.final_responses){
      if(!expected.delete(f.question_instance_id))throw transportError(422,'INVALID_FINALIZATION');
      const answer=byId.get(f.response_event_id);
      if(f.status==='answered' || f.status==='skipped' && f.response_event_id!==null){
        if(answer?.event_type!==(f.status==='answered'?'answer.submitted':'question.skipped') ||
          answer.payload.question_instance_id!==f.question_instance_id)throw transportError(422,'INVALID_FINALIZATION');
      }else if(f.response_event_id!==null)throw transportError(422,'INVALID_FINALIZATION');
    }
    if(expected.size)throw transportError(422,'INVALID_FINALIZATION');
    return {attempt_id,status:'complete',grading_state:'unverified',receipt_origin:'mock',missing_sequences:[]};
  }
}
export class RemoteApiAdapter {
  constructor(scope,config={}){this.scope=scope;this.config=config;this.origin='server';}
  async request(path,method='GET',data,signal) {
    const {apiBaseUrl,csrfToken,fetcher=globalThis.fetch,environment_id}=this.config;
    if(!apiBaseUrl)throw transportError(0,'BRIDGE_NOT_CONFIGURED');
    const url=new URL(apiBaseUrl),origin=globalThis.location?.origin??this.config.testOrigin;
    if(url.origin!==origin || url.protocol!=='https:' || url.search||url.hash||url.username||url.password ||
      environment_id!==this.scope.environment)throw transportError(403,'INVALID_ENDPOINT');
    if(method!=='GET' && !csrfToken)throw transportError(403,'CSRF_REQUIRED');
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),this.config.timeoutMs??12000);
    const abort=()=>ctl.abort();signal?.addEventListener('abort',abort,{once:true});
    try{
      signal?.throwIfAborted();
      const r=await fetcher(url.href.replace(/\/$/,'')+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',
        headers:method==='GET'?{Accept:'application/json'}:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrfToken},
        ...(data?{body:JSON.stringify(data)}:{}),signal:ctl.signal});
      if(!r.ok){
        const retry=r.headers.get('Retry-After');const wait=retry===null?0:/^\d+$/.test(retry)?Number(retry)*1000:Math.max(0,Date.parse(retry)-Date.now())||0;
        const info=await r.json().catch(()=>null);throw transportError(r.status,info?.error?.code,wait);
      }
      try{return await r.json();}catch{throw transportError(502,'MALFORMED_RESPONSE');}
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  async getCapabilities(signal){
    const c=await this.request('/capabilities','GET',undefined,signal);
    if(c.environment_id!==this.scope.environment || !c.schema_versions?.includes(VERSION))throw transportError(422,'UNSUPPORTED_SCHEMA');
    return c;
  }
  async getIdentity(signal){
    const i=await this.request('/me','GET',undefined,signal);
    if(i.subject!==this.scope.profileId||i.environment_id!==this.scope.environment)throw transportError(403,'SCOPE_CHANGED');
    return i;
  }
  listAssignments(){return this.request('/assignments');}
  startAttempt(binding,signal){return this.request('/attempts','POST',binding,signal);}
  async sendEventBatch(batch,{signal}={}) {
    if(!this.config.apiBaseUrl)throw transportError(0,'BRIDGE_NOT_CONFIGURED');
    await checkBatch(batch,this.scope);await this.getIdentity(signal);
    const ack=await this.request('/events/batch','POST',batch,signal);correlate(batch,ack,'server');return ack;
  }
  completeAttempt(data,signal){return this.request('/attempts/complete','POST',data,signal);}
  getProgress(){return this.request('/students/'+encodeURIComponent(this.scope.profileId)+'/progress');}
  requestReport(data){return this.request('/reports','POST',data);}
}
