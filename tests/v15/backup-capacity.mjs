// Run each case in its own process to keep the 50 MiB and 100,000-row fixtures independent.
import assert from 'node:assert/strict';
import {constants as bufferLimits} from 'node:buffer';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createAttempt,begin,editDraft} from '../../src/player/engine.mjs';
import * as store from '../../src/data/store.js';
import {transaction,row,key} from '../../src/data/db.js';
import {exportBackup,exportArchive,exportRecoveryBackup,readBackup,previewBackup,importBackup} from '../../src/data/backup.js';

const kind=process.argv[2];
assert(['rows','bytes'].includes(kind),'Use rows or bytes');
const jsonBlob=b=>new Blob([JSON.stringify(b)],{type:'application/json'});
const profile=await store.createProfile('Capacity '+kind);
const scope=store.scopeForLocal(profile.id),ns=store.scopeKey(scope);
const pkg=JSON.parse(await readFile(new URL('../../spec/examples/PACKAGE_CONTRACT_EXAMPLE.json',import.meta.url)));
const attempt=createAttempt(pkg,scope,{mode:'practice',seed:78});
await store.saveAttempt(attempt,begin(attempt),scope);
const events=await store.listEvents(attempt.attempt_id,scope);
assert.equal(events.length,1);
const get=async i=>(await transaction(['records'],false,tx=>tx.get('records',key(ns,'case|r'+i))))?.data.value;
const checks=[];
function record(name,observed){checks.push({name,status:'PASS',observed});}

async function insert(count,value,start=0){
  await transaction(['records'],true,async tx=>{
    for(let i=start;i<start+count;i++)await tx.put('records',row(ns,'case|r'+i,{type:'case',id:'r'+i,value:value(i)}));
  });
}
async function restore(blob,count,draft){
  const original=await store.profileImpact(profile.id);
  const old=await store.getAttempt(attempt.attempt_id,scope);
  assert.deepEqual(original,{records:count,sessions:1,events:1});
  const preview=await previewBackup(blob);
  assert.equal(preview.sessions,1);assert.equal(preview.recovery_draft,draft!==null);
  assert.equal(preview.conflicts.length,0);
  assert.deepEqual(await store.profileImpact(profile.id),original);
  assert.deepEqual(await store.getAttempt(attempt.attempt_id,scope),old);
  await store.deleteProfile(profile.id);
  const restored=await importBackup(blob);
  assert.equal(restored.additions,count+3); // profile + attempt + event + records
  assert.deepEqual(await store.profileImpact(profile.id),original);
  const actual=await store.getAttempt(attempt.attempt_id,scope);
  if(draft===null)assert.deepEqual(actual,old);
  else{
    assert.equal(actual.status,'ongoing');assert.equal(actual.items[0].draft,draft);
    assert.equal(actual.items[0].dirty,true);assert.equal(actual._rev,old._rev+1);
    assert.equal(actual._seq,old._seq);
  }
  assert.deepEqual(await store.listEvents(attempt.attempt_id,scope),events);
  return {rows:count+2,bytes:blob.size,format:blob.type,preview_sessions:preview.sessions,restored_additions:restored.additions,draft};
}
if(kind==='rows'){
  await insert(99998,i=>i);
  const exact=jsonBlob(await exportBackup(scope));
  record('100000 mixed rows accepted in JSON, previewed and restored',await restore(exact,99998,null));
  await insert(1,i=>i,99998);
  await assert.rejects(()=>exportBackup(scope),{code:'BACKUP_TOO_LARGE'});
  const zip=await exportArchive(scope);
  record('100001 mixed rows refused as JSON and restored as ZIP',await restore(zip,99999,null));
  await insert(2,i=>i,99999);editDraft(attempt,0,'2/','id');
  const rescue=await exportRecoveryBackup(scope,attempt);
  assert(rescue instanceof Blob);assert.equal(rescue.type,'application/zip');
  record('100003 mixed rows, ongoing draft recovery ZIP',await restore(rescue,100001,'2/'));
  await insert(49997,i=>i,100001);
  record('150000 mixed rows restored from a multipart archive',await restore(await exportArchive(scope,{partTarget:1<<20}),149998,null));
  // Independently verify every stored record without consulting the archive encoder.
  await transaction(['records'],false,async tx=>{
    let n=0;
    await tx.scan('records',ns,r=>{const i=Number(r.id.slice('case|r'.length));assert.equal(r.id,'case|r'+i);assert.equal(r.data.value,i);n++;});
    assert.equal(n,149998);
  });
}else{
  const maxBytes=50*1024*1024,notes=270;
  await insert(notes,()=>'');
  const header=jsonBlob(await exportBackup(scope)).size;
  // Fill with two-byte UTF-8 letters plus at most one ASCII byte. Every
  // individual field remains below the independent reader string-length cap.
  let remaining=maxBytes-header;
  const text=[];
  for(let i=0;i<notes;i++){
    const bytes=Math.min(remaining,198000);
    text.push('é'.repeat(Math.floor(bytes/2))+(bytes%2?'x':''));
    remaining-=bytes;
  }
  assert.equal(remaining,0);await insert(notes,i=>text[i]);
  const exact=jsonBlob(await exportBackup(scope));assert.equal(exact.size,maxBytes);
  record('52428800 UTF-8 bytes accepted in both directions',await restore(exact,notes,null));
  assert.equal(await get(0),text[0]);assert.equal(await get(notes-1),text.at(-1));
  // A plain backup fits but adding the exact draft envelope exceeds the limit.
  editDraft(attempt,0,'3/','en');
  // A large legacy JSON can exceed a browser's maximum string length while
  // remaining representable as a ZIP of small parts. The recovery path must
  // decide before ever serializing the full over-limit envelope.
  let rescue,wholeFileAttempts=0;
  const stringify=JSON.stringify;
  JSON.stringify=function(value,...args){
    if(value?.format==='kalibataku-profile-backup' && value.records?.records?.length===notes){
      wholeFileAttempts++;
      throw new RangeError('The complete legacy JSON cannot be materialized');
    }
    return stringify.call(JSON,value,...args);
  };
  try{rescue=await exportRecoveryBackup(scope,attempt);}
  finally{JSON.stringify=stringify;}
  assert.equal(wholeFileAttempts,0);assert.equal(rescue.type,'application/zip');
  record('draft envelope crosses UTF-8 byte limit, archive restores draft',
    {...await restore(rescue,notes,'3/'),whole_file_serializations:wholeFileAttempts});
  // Profile is now restored with its draft committed. Its envelope can grow or
  // shrink on restore, so set the new raw JSON size to exactly maxBytes + 1.
  await insert(1,()=>'',0);
  const without=jsonBlob(await exportBackup(scope)).size;
  const extra=maxBytes+1-without;
  await insert(1,()=>'é'.repeat(Math.floor(extra/2))+(extra%2?'x':''),0);
  await assert.rejects(()=>exportBackup(scope),{code:'BACKUP_TOO_LARGE'});
  await assert.rejects(()=>readBackup(new Blob([exact,' '])),{code:'BACKUP_TOO_LARGE'});
  record('52428801 UTF-8 bytes refused by writer and serialized reader',{bytes:maxBytes+1,code:'BACKUP_TOO_LARGE'});
  const shared='z'.repeat(96000),count=6000;
  // Distinct rows share a small immutable value in the fixture; no 550 MiB
  // string is ever constructed. All individual rows fit the ZIP part limit.
  const entries=Array.from({length:count},(_,i)=>({id:'case|v'+i,data:{type:'case',id:'v'+i,value:shared}}));
  const virtual={format:'kalibataku-profile-backup',records:{attempts:[],events:[],records:entries},checksum:'0'.repeat(64)};
  const valueCharacters=shared.length*count;
  assert(valueCharacters>bufferLimits.MAX_STRING_LENGTH && valueCharacters<1024**3);
  await assert.rejects(()=>readBackup(virtual),{code:'BACKUP_TOO_LARGE'});
  record('object reader rejects a logical >V8 max-string profile by capacity',{rows:count,value_characters:valueCharacters,
    engine_maximum_string_length:bufferLimits.MAX_STRING_LENGTH,code:'BACKUP_TOO_LARGE'});
}
const root=new URL('../../',import.meta.url),distribution=JSON.parse(await readFile(new URL('dist/offline-assets.json',root)));
const sources={};
for(const file of ['data/backup.js','data/backup-json-size.js','data/backup-reader.worker.js','data/panel-profile.js','data/snapshot-check.js']){
  const candidate=createHash('sha256').update(await readFile(new URL('src/'+file,root))).digest('hex');
  sources[file]={tested_source_sha256:candidate,dist_matches:distribution.assets.some(a=>a.path===file&&a.sha256===candidate)};
}
console.log(JSON.stringify({offline_release:distribution.release,modules:sources,command:'node tests/v15/backup-capacity.mjs '+kind,runtime:process.version,backend:'Node memory adapter, synthetic profiles',time:new Date().toISOString(),checks},null,2));
