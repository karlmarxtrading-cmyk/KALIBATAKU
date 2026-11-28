import {epoch,compareInstants} from './time.js';
import {scopeKey,sha256,canonical,VERSION,SAFE_ID,invariant,now,eventHash} from './common.js';
import {transaction,row,key} from './db.js';
import {scopeForLocal,activeScope,listProfiles} from './store.js';
import {syncSummary} from './summary.js';
import {validate} from './validate.js';
import {assertJsonBackupSize,JSON_MAX_BYTES} from './backup-json-size.js';
const TABLES=['attempts','events','records'];
// Validation counts are local observations, never trusted fields of the imported data.
const journeyChecks = new WeakMap();
export const journeyCheckSummary = backup => journeyChecks.get(backup);
// Format 1 (single JSON) keeps its original limits. Larger profiles use the archive
// format 2 below; its limits bound memory per part and in total.
const MAX_ROWS=100000;
export const ARCHIVE={format:'kalibataku-profile-archive',version:2,part_target:8*1024*1024,max_part:32*1024*1024,
  max_total:1024*1024*1024,max_file:512*1024*1024,max_rows:2000000,max_parts:4000};
async function digest(body){return sha256(canonical(body,false));}
function local(s){invariant(s.origin==='local_practice'&&s.environment==='device','LOCAL_PROFILE_ONLY');return scopeKey(s);}
function assertRowLimit(records,limit){
  let total=0;
  for(const table of TABLES){
    invariant(Array.isArray(records[table]),'INVALID_BACKUP');
    total+=records[table].length;
  }
  invariant(total<=limit,'BACKUP_TOO_LARGE');
}
async function jsonBackup({profile,records},recovery){
  assertRowLimit(records,MAX_ROWS);
  const body={format:'kalibataku-profile-backup',schema_version:VERSION,release_id:'kalibataku-static-1',data_origin:'local_practice',
    exported_at:now(),verification_status:'unverified',profile,records};
  if(recovery)body.recovery_draft=recovery;
  // Count the exact downloaded UTF-8 JSON, including the checksum and any
  // recovery draft. A SHA-256 checksum always occupies 64 ASCII bytes.
  const backup={...body,checksum:'0'.repeat(64)};
  assertJsonBackupSize(backup);
  backup.checksum=await digest(body);
  return backup;
}
export async function exportBackup(scope=activeScope()){
  return jsonBackup(await profileRows(scope));
}
// Read the owner, attempt, events and other records in one transaction. Both
// output formats use those same rows even if another tab saves meanwhile.
export async function exportRecoveryBackup(scope,snapshot){
  const source=await profileRows(scope);
  const current=source.records.attempts.find(r=>r.id===snapshot?.attempt_id)?.data;
  invariant(current && snapshot.profile_id===source.profile.id && snapshot.data_origin==='local_practice','RECOVERY_STALE');
  const item=snapshot.items[snapshot.index],base=current.items.find(x=>x.question_instance_id===item?.question_instance_id);
  let recovery=null;
  if(current.status==='ongoing' && base && item.dirty && (item.draft!==base.draft || item.draft_locale!==base.draft_locale)){
    invariant(current._rev===snapshot._rev && current._seq===snapshot._seq,'RECOVERY_STALE');
    recovery={attempt_id:current.attempt_id,instance_id:base.question_instance_id,revision:current._rev,
      sequence:current._seq,text:item.draft,locale:item.draft_locale};
  }
  let backup;
  try{backup=await jsonBackup(source,recovery);}
  catch(error){
    if(error.code!=='BACKUP_TOO_LARGE')throw error;
    const blob=await archiveFromRows(source,{recovery});
    await readArchive(blob);
    return blob;
  }
  return readBackup(backup);
}
function applyDraft(record,patch){
  const a=structuredClone(record);
  const index=a.items.findIndex(i=>i.question_instance_id===patch.instance_id);
  invariant(a.status==='ongoing' && a._rev===patch.revision && a._seq===patch.sequence && index>=0,'RECOVERY_STALE');
  Object.assign(a.items[index],{draft:patch.text,draft_locale:patch.locale,dirty:true,feedback:false});
  a.index=index;a._rev++;
  return a;
}
function validateTree(v,depth=0){
  invariant(depth<=48,'INVALID_BACKUP');
  if(typeof v==='string') {invariant(v.length<=100000,'INVALID_BACKUP');return;}
  if(v && typeof v==='object') {
    invariant(Array.isArray(v)||Object.getPrototypeOf(v)===Object.prototype,'INVALID_BACKUP');
    for(const [k,x] of Object.entries(v)){
      invariant(!['__proto__','prototype','constructor'].includes(k),'INVALID_BACKUP');
      validateTree(x,depth+1);
    }
  }
}
function notOtherFile(b){
  if(b?.attempt_id && Array.isArray(b?.items) || b?.format==='kalibataku-session-copy')throw Object.assign(new Error('SESSION_COPY'),{code:'SESSION_COPY'});
  if(b?.report_id || b?.core?.report_id || String(b?.schema_version||'').startsWith('parents-report'))throw Object.assign(new Error('REPORT_FILE'),{code:'REPORT_FILE'});
}
function validProfileHeader(b,format){
  return b && b.format===format && b.schema_version===VERSION && b.data_origin==='local_practice' &&
    b.verification_status==='unverified' && b.profile && typeof b.profile.id==='string'&&SAFE_ID.test(b.profile.id)&&
    typeof b.profile.name==='string'&&b.profile.name.length<=80 && typeof b.release_id==='string'&&Number.isFinite(epoch(b.exported_at));
}
export async function readBackup(input){
  let b=input;
  if(input instanceof Blob || typeof input==='string'){
    invariant((input instanceof Blob?input.size:new Blob([input]).size)<=JSON_MAX_BYTES,'BACKUP_TOO_LARGE');
    b=JSON.parse(input instanceof Blob?await input.text():input);
  } else if(b?.records && Object.keys(b.records).length===TABLES.length && TABLES.every(t=>Array.isArray(b.records[t]))){
    assertRowLimit(b.records,MAX_ROWS);
    assertJsonBackupSize(b);
  } else invariant(new Blob([JSON.stringify(b)]).size<=JSON_MAX_BYTES,'BACKUP_TOO_LARGE');
  validateTree(b);notOtherFile(b);
  invariant(validProfileHeader(b,'kalibataku-profile-backup')&&b.records && Object.keys(b.records).length===TABLES.length,'INVALID_BACKUP');
  assertRowLimit(b.records,MAX_ROWS);
  const {checksum,...body}=b;invariant(checksum===await digest(body),'CHECKSUM_MISMATCH');
  await validateRecords(b,MAX_ROWS);
  return b;
}
// Row, event-hash and snapshot validation shared by format 1 and format 2.
async function validateRecords(b,maxRows){
  const attempts=new Map(),seq=new Set(),eventsByAttempt=new Map(),startChoices=new Set();
  assertRowLimit(b.records,maxRows);
  for(const t of TABLES){
    const ids=new Set();
    for(const r of b.records[t]){
      invariant(r && typeof r.id==='string'&&!ids.has(r.id) && r.data && typeof r.data==='object','INVALID_BACKUP');ids.add(r.id);
      if(t==='attempts'){
        const a=r.data;
        invariant(SAFE_ID.test(r.id)&&a.attempt_id===r.id&&a.profile_id===b.profile.id && a.data_origin==='local_practice'&&
          Number.isSafeInteger(a._seq)&&a._seq>=0&&Number.isSafeInteger(a._rev)&&a._rev>=1 &&
          Array.isArray(a.items)&&a.items.length>=1&&a.items.length<=200 && ['practice','assessment','adaptive','speed','recovery'].includes(a.mode) &&
          SAFE_ID.test(a.package_id),'INVALID_BACKUP_ATTEMPT');attempts.set(r.id,a);
      }else if(t==='events'){
        const e=validate('Event',r.data),slot=e.attempt_id+'|'+e.event_sequence;
        invariant(SAFE_ID.test(r.id)&&e.event_id===r.id&&attempts.has(e.attempt_id)&& e.provenance.data_origin==='local_practice'&&
          e.provenance.local_profile_id===b.profile.id&&e.provenance.dataset_id==='device'&& e.provenance.server_subject_ref===null &&
          !seq.has(slot)&&e.event_sequence<=attempts.get(e.attempt_id)._seq&&e.payload_hash===await eventHash(e),'INVALID_BACKUP_EVENT');
        seq.add(slot);if(!eventsByAttempt.has(e.attempt_id))eventsByAttempt.set(e.attempt_id,[]);eventsByAttempt.get(e.attempt_id).push(e);
      }else{
        if(r.data.type==='journey-start'){
          const choice=r.data.value;
          invariant(/^S-G(0[1-9]|1[0-2])-L0[1-5]$/.test(choice?.stage_id) && typeof choice.at==='string' && Number.isFinite(epoch(choice.at)), 'INVALID_BACKUP_JOURNEY');
          if(Object.hasOwn(choice,'revision') || Object.hasOwn(choice,'intent_id')) {
            invariant(Number.isSafeInteger(choice.revision) && choice.revision>0 && choice.intent_id===r.data.id, 'INVALID_BACKUP_JOURNEY');
          }
          startChoices.add(r.data.id);
        }
        invariant(typeof r.data.type==='string' && typeof r.data.id==='string' && SAFE_ID.test(r.data.type)&&SAFE_ID.test(r.data.id)&&r.id===r.data.type+'|'+r.data.id&&Object.hasOwn(r.data,'value'),'INVALID_BACKUP_RECORD');
      }
    }
  }
  const {validateSnapshot}=await import('./snapshot-check.js');
  const checks={internal_only:0,occurrences_matched:0,bank_matched:0};
  let journeySource;
  for(const a of attempts.values()){
    if(a.journey?.start_intent_id)invariant(startChoices.has(a.journey.start_intent_id),'INVALID_BACKUP_JOURNEY');
    const events=eventsByAttempt.get(a.attempt_id)||[];
    invariant(events.length===a._seq,'INVALID_BACKUP_EVENT');
    if (a.journey && !journeySource) {
      const {createJourneySourceReader} = await import('./journey-snapshot.js');
      journeySource = createJourneySourceReader();
    }
    const result = await validateSnapshot(a,events,journeySource);
    if (result) checks[result]++;
  }
  journeyChecks.set(b,checks);
  if(b.recovery_draft){
    const d=b.recovery_draft,a=attempts.get(d.attempt_id);
    invariant(a && typeof d.text==='string' && d.text.length<=80 && ['id','en'].includes(d.locale),'INVALID_BACKUP');
    const restored=applyDraft(a,d);await validateSnapshot(restored,eventsByAttempt.get(a.attempt_id)||[],journeySource);
  }
}
// ---------- Format 2: profile archive (ZIP with manifest and checksummed parts) ----------
const partName=i=>'parts/part-'+String(i).padStart(5,'0')+'.json';
const utf8=new TextEncoder();
async function profileRows(scope){
  const ns=local(scope);await listProfiles();
  return transaction([...TABLES,'profiles'],false,async tx=>{
    const profile=(await tx.get('profiles',key('device',scope.profileId)))?.data;
    invariant(profile,'INVALID_PROFILE');
    const records={};
    for(const t of TABLES) records[t]=(await tx.all(t,ns)).map(r=>({id:r.id,data:r.data}));
    return {profile,records};
  });
}
// Each attempt travels with all of its events in the same part, so a part can be
// checked on its own. Rows keep store order inside a part; parts are numbered.
export async function exportArchive(scope=activeScope(),options={}){
  return archiveFromRows(await profileRows(scope),options);
}
async function archiveFromRows({profile,records},{signal,onProgress=()=>{},partTarget=ARCHIVE.part_target,recovery=null,app_version=null}={}){
  signal?.throwIfAborted();
  assertRowLimit(records,ARCHIVE.max_rows);
  const byAttempt=new Map();for(const e of records.events){const id=e.data.attempt_id;if(!byAttempt.has(id))byAttempt.set(id,[]);byAttempt.get(id).push(e);}
  const attempts=[...records.attempts].sort((x,y)=>compareInstants(x.data.started_at,y.data.started_at)||x.id.localeCompare(y.id));
  const parts=[];let current={attempts:[],events:[],records:[]},size=0;
  const flush=()=>{if(current.attempts.length||current.records.length){parts.push(current);current={attempts:[],events:[],records:[]};size=0;}};
  for(const a of attempts){
    const ev=(byAttempt.get(a.id)||[]).sort((x,y)=>x.data.event_sequence-y.data.event_sequence);
    const weight=JSON.stringify(a).length+ev.reduce((s,e)=>s+JSON.stringify(e).length,0);
    if(size&&size+weight>partTarget)flush();
    current.attempts.push(a);for(const e of ev)current.events.push(e);size+=weight;byAttempt.delete(a.id);
  }
  // Events without a stored attempt cannot be restored by format 1 either; keep them visible.
  invariant(byAttempt.size===0,'INVALID_BACKUP_EVENT');
  flush();
  // Records are split by the same part target as attempts, so the writer never emits a
  // part that the reader's per-part limit would reject (writer/reader limits aligned).
  for(const r of records.records){
    const weight=JSON.stringify(r).length+1;
    if(size&&size+weight>partTarget)flush();
    current.records.push(r);size+=weight;
  }
  flush();
  if(!parts.length)parts.push({attempts:[],events:[],records:[]});
  invariant(parts.length<=ARCHIVE.max_parts,'BACKUP_TOO_LARGE');
  const files=[],listing=[];let totalBytes=0;
  for(let i=0;i<parts.length;i++){
    signal?.throwIfAborted();
    const body={format:ARCHIVE.format+'-part',profile_id:profile.id,index:i+1,records:parts[i]};
    const bytes=utf8.encode(JSON.stringify(body));totalBytes+=bytes.length;
    invariant(bytes.length<=ARCHIVE.max_part&&totalBytes<=ARCHIVE.max_total,'BACKUP_TOO_LARGE');
    listing.push({index:i+1,name:partName(i+1),bytes:bytes.length,sha256:await sha256(bytes),attempts:parts[i].attempts.length,events:parts[i].events.length,records:parts[i].records.length});
    files.push({name:partName(i+1),bytes});onProgress({phase:'pack',done:i+1,total:parts.length});
  }
  const manifest={format:ARCHIVE.format,archive_version:ARCHIVE.version,schema_version:VERSION,release_id:'kalibataku-static-1',
    app_version,data_origin:'local_practice',verification_status:'unverified',exported_at:now(),profile,
    totals:{attempts:records.attempts.length,events:records.events.length,records:records.records.length,parts:listing.length},parts:listing};
  if(recovery)manifest.recovery_draft=recovery;
  const signed={...manifest,checksum:await digest(manifest)};
  const {writeZip}=await import('./archive.js');
  const blob=await writeZip([{name:'manifest.json',bytes:utf8.encode(JSON.stringify(signed))},...files],{signal,onEntry:()=>onProgress({phase:'compress'})});
  invariant(blob.size<=ARCHIVE.max_file,'BACKUP_TOO_LARGE');
  return blob;
}
export async function readArchive(blob,{signal,onProgress=()=>{}}={}){
  const {readZipIndex,readEntry}=await import('./archive.js');
  invariant(blob.size<=ARCHIVE.max_file,'BACKUP_TOO_LARGE');
  const entries=await readZipIndex(blob,{allowed:n=>n==='manifest.json'||/^parts\/part-\d{5}\.json$/.test(n),maxEntries:ARCHIVE.max_parts+1});
  invariant(entries.has('manifest.json'),'INVALID_BACKUP');
  const dec=new TextDecoder('utf-8',{fatal:true});
  const m=JSON.parse(dec.decode(await readEntry(blob,entries.get('manifest.json'),{limit:4*1024*1024,signal})));
  validateTree(m);notOtherFile(m);
  invariant(validProfileHeader(m,ARCHIVE.format)&&m.archive_version===ARCHIVE.version&&Array.isArray(m.parts)&&m.parts.length>=1&&m.parts.length<=ARCHIVE.max_parts&&m.totals&&typeof m.totals==='object','INVALID_BACKUP');
  const {checksum,...signed}=m;invariant(checksum===await digest(signed),'CHECKSUM_MISMATCH');
  // The manifest lists every part exactly once, in order; the archive holds exactly those parts.
  invariant(m.parts.every((p,i)=>p&&p.index===i+1&&p.name===partName(i+1)&&Number.isSafeInteger(p.bytes)&&p.bytes>0&&p.bytes<=ARCHIVE.max_part&&/^[a-f0-9]{64}$/.test(p.sha256)),'INVALID_BACKUP');
  for(const p of m.parts)invariant(entries.has(p.name),'ARCHIVE_PART_MISSING');
  invariant(entries.size===m.parts.length+1,'INVALID_BACKUP');
  const sum=k=>m.parts.reduce((s,p)=>s+p[k],0);
  invariant(sum('attempts')===m.totals.attempts&&sum('events')===m.totals.events&&sum('records')===m.totals.records&&m.totals.parts===m.parts.length&&sum('bytes')<=ARCHIVE.max_total,'INVALID_BACKUP');
  const records={attempts:[],events:[],records:[]};
  for(const p of m.parts){
    signal?.throwIfAborted();
    const bytes=await readEntry(blob,entries.get(p.name),{limit:Math.min(p.bytes,ARCHIVE.max_part),signal});
    invariant(bytes.length===p.bytes&&await sha256(bytes)===p.sha256,'CHECKSUM_MISMATCH');
    const part=JSON.parse(dec.decode(bytes));validateTree(part);
    invariant(part&&part.format===ARCHIVE.format+'-part'&&part.profile_id===m.profile.id&&part.index===p.index&&part.records&&
      Object.keys(part.records).length===TABLES.length&&TABLES.every(t=>Array.isArray(part.records[t])&&part.records[t].length===p[t]),'INVALID_BACKUP');
    // TEK-01: append row by row. Spreading a large part into push() overflows the
    // call stack; this loop is bounded only by ARCHIVE.max_rows checked below.
    for(const t of TABLES){const into=records[t],from=part.records[t];for(let k=0;k<from.length;k++)into.push(from[k]);}
    invariant(records.attempts.length+records.events.length+records.records.length<=ARCHIVE.max_rows,'BACKUP_TOO_LARGE');
    onProgress({phase:'verify',done:p.index,total:m.parts.length});
  }
  const b={format:'kalibataku-profile-backup',schema_version:m.schema_version,release_id:m.release_id,data_origin:m.data_origin,
    exported_at:m.exported_at,verification_status:m.verification_status,profile:m.profile,records,
    archive:{format:m.format,version:m.archive_version,parts:m.parts.length,checksum:m.checksum,app_version:m.app_version??null}};
  if(m.recovery_draft)b.recovery_draft=m.recovery_draft;
  await validateRecords(b,ARCHIVE.max_rows);
  return b;
}
export async function readAny(input,opts={}){
  const {isZip}=await import('./archive.js');
  return input instanceof Blob&&await isZip(input)?readArchive(input,opts):readBackup(input);
}
async function compare(b,commit) {
  const ns=local(scopeForLocal(b.profile.id));
  return transaction(['profiles',...TABLES],commit,async tx=>{
    const dates=b.records.attempts.map(r=>r.data.started_at).sort(compareInstants);
    const result={additions:0,duplicates:0,conflicts:[],profile:b.profile.name,profile_id:b.profile.id,
      sessions:dates.length,first_date:dates[0]||null,last_date:dates.at(-1)||null,
      exported_at:b.exported_at,format:b.format,schema_version:b.schema_version,archive:b.archive||null,
      recovery_draft:!!b.recovery_draft,journey_checks:journeyCheckSummary(b)};
    // Keep the entire comparison and commit in one transaction. A bounded
    // batch queues independent IDB requests together for large profiles.
    const batchSize=256,missing=new Map();
    for(const [t,records] of [['profiles',[{id:b.profile.id,data:b.profile}]],...TABLES.map(t=>[t,b.records[t]])]){
      const dest=t==='profiles'?'device':ns;
      const empty=records.length>=batchSize && await tx.count(t,dest)===0;
      const additions=[];
      for(let start=0;start<records.length;start+=batchSize){
        const batch=records.slice(start,start+batchSize);
        const existing=empty?[]:await Promise.all(batch.map(r=>tx.get(t,key(dest,r.id))));
        for(let i=0;i<batch.length;i++){
          const r=batch[i],old=existing[i];
          const patch=t==='attempts'&&b.recovery_draft?.attempt_id===r.id?b.recovery_draft:null;
          const entry=row(dest,r.id,patch?applyDraft(r.data,patch):r.data);
          if(!old){if(commit)additions.push(entry);result.additions++;}
          else if(canonical(old.data,false)===canonical(entry.data,false))result.duplicates++;
          else if(patch && canonical(old.data,false)===canonical(r.data,false)){
            if(commit)additions.push(entry);result.additions++;
          }else result.conflicts.push({table:t,id:r.id});
        }
      }
      missing.set(t,additions);
    }
    if(commit){
      invariant(!result.conflicts.length,'IMPORT_CONFLICT');
      for(const [t,entries] of missing){
        if(t==='attempts'){
          for(const entry of entries){
            const added=!(await tx.get(t,entry.key));
            await tx.put(t,entry);
            await syncSummary(tx,ns,entry.data,added,0);
          }
        }else{
          for(let start=0;start<entries.length;start+=batchSize){
            await Promise.all(entries.slice(start,start+batchSize).map(entry=>tx.put(t,entry)));
          }
        }
      }
    }
    return result;
  });
}
// Large file parsing, checksum and mathematical/event validation stay off the
// UI thread. The caller still owns the atomic write in its own storage context.
async function validatedInput(input,signal){
  signal?.throwIfAborted();
  if(typeof window==='undefined' || typeof Worker==='undefined' || !(input instanceof Blob))return readAny(input,{signal});
  const result=await new Promise((resolve,reject)=>{
    let worker;
    try{worker=new Worker(new URL('./backup-reader.worker.js',import.meta.url),{type:'module'});}
    catch{resolve(null);return;}
    const stop=()=>{worker.terminate();signal?.removeEventListener('abort',abort);};
    const abort=()=>{stop();reject(new DOMException('Navigation','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
    worker.onmessage=({data})=>{
      stop();
      if(data.error)reject(Object.assign(new Error(data.error),{code:data.error}));
      else {journeyChecks.set(data.backup,data.journey_checks);resolve(data.backup);}
    };
    worker.onerror=()=>{stop();resolve(null);};
    worker.postMessage(input);
  });
  signal?.throwIfAborted();
  return result||readAny(input,{signal});
}
export async function previewBackup(input,{signal}={}){
  const b=await validatedInput(input,signal);signal?.throwIfAborted();return compare(b,false);
}
export async function importBackup(input,{signal}={}){
  const b=await validatedInput(input,signal);signal?.throwIfAborted();return compare(b,true);
}
