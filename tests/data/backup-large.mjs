// TECH-01 regression: large profile history is exported as a format-2 archive and fully
// restored into EMPTY storage in a separate Node process. Node uses the app's explicit
// transactional memory adapter; native IndexedDB is covered by the browser suite.
//   node tests/data/backup-large.mjs            (orchestrates both phases)
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Suite,receiptPath} from '../qa/receipt.mjs';
import {createAttempt,begin,visit,editDraft,submit,finish,noteHint} from '../../src/player/engine.mjs';
import {createProfile,scopeForLocal,saveAttempt,listEvents,listAttempts,listProfiles,addRecord} from '../../src/data/store.js';
import {exportBackup,exportArchive,readArchive,readAny,previewBackup,importBackup,readBackup,ARCHIVE} from '../../src/data/backup.js';
import {canonical} from '../../src/data/common.js';

const ROOT=new URL('../../',import.meta.url);
const phase=process.argv[2]||'main';
const SESSIONS=Number(process.env.KALIBATAKU_LARGE_SESSIONS||250);
async function pack(id){
  const [,g,l]=id.match(/^MM-G(\d\d)-L(\d\d)-/);
  const shard=JSON.parse(await readFile(new URL(`dist/bank/g${g}/l${l}.json`,ROOT),'utf8'));
  const info=shard.competencies.flatMap(c=>c.packages).find(p=>p.package_id===id);
  return (await import(new URL('dist/'+info.url,ROOT).href)).default;
}
const answerText=(v,lang)=>v.denominator==='1'?v.numerator:v.numerator+'/'+v.denominator;
// Stable fingerprint of everything a restore must keep, row by row.
async function fingerprint(scope){
  const attempts=(await listAttempts(scope)).sort((a,b)=>a.attempt_id.localeCompare(b.attempt_id));
  const events=(await listEvents(null,scope)).sort((a,b)=>a.event_id.localeCompare(b.event_id));
  const detail=attempts.map(a=>({id:a.attempt_id,status:a.status,metrics:a.metrics,seq:a._seq,rev:a._rev,
    items:a.items.map(i=>({q:i.question.question_id,first:i.first_correct,final:i.final_correct,status:i.final_status,
      raw:i.history.map(h=>[h.raw_answer,h.answer_locale??h.draft_locale??null,h.is_correct,h.key_seen_before,h.hint_before,h.event_id])}))}));
  const ev=events.map(e=>[e.event_id,e.attempt_id,e.event_sequence,e.event_type,e.payload_hash]);
  const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])])):v;
  const h=x=>createHash('sha256').update(JSON.stringify(sort(x))).digest('hex');
  return {attempts:attempts.length,events:events.length,attempt_rows_sha256:h(attempts),event_rows_sha256:h(events),detail_sha256:h(detail),ledger_sha256:h(ev),
    first_ids:attempts.slice(0,2).map(a=>a.attempt_id),sample_raw:detail.find(d=>d.items.some(i=>i.raw.length>1))?.items.find(i=>i.raw.length>1)?.raw};
}

if(phase==='main'){
  const suite=new Suite('TECH-01-large-backup',{scope:'Format-2 archive export and restore into empty storage; corruption and resource limits'});
  const dir=await mkdtemp(join(tmpdir(),'kalibataku-large-'));
  const big=await pack('MM-G12-L05-MIX-P001'),mix=await pack('MM-G05-L03-ADD-P001');
  const profile=await createProfile('Synthetic long-history QA');const scope=scopeForLocal(profile.id);
  const started=performance.now();
  for(let n=1;n<=SESSIONS;n++){
    const lang=n%2?'en':'id';
    const a=createAttempt(big,scope,{lang,mode:'practice'});await saveAttempt(a,begin(a),scope);
    const commands=[];
    for(let i=0;i<a.items.length;i++){visit(a,i);editDraft(a,i,answerText(a.items[i].question.answer,lang),lang);commands.push(submit(a,i));}
    await saveAttempt(a,commands,scope);await saveAttempt(a,finish(a),scope);
  }
  // Mixed dataset: wrong first response, hint, revision after the key, ID/EN locales, five modes, one ongoing session.
  for(const [k,mode] of ['practice','adaptive','recovery','speed','assessment','practice'].entries()){
    const lang=k%2?'en':'id';
    const a=createAttempt(mix,scope,{lang,mode,question_count:3});await saveAttempt(a,begin(a),scope);
    if(mode!=='assessment')await saveAttempt(a,noteHint(a,0),scope);
    editDraft(a,0,'999',lang);await saveAttempt(a,submit(a,0),scope);
    editDraft(a,0,answerText(a.items[0].question.answer,lang),lang);await saveAttempt(a,submit(a,0),scope);
    visit(a,1);editDraft(a,1,lang==='id'?'0,5':'0.5',lang);await saveAttempt(a,submit(a,1),scope);
    if(k<5)await saveAttempt(a,finish(a),scope);else await saveAttempt(a,null,scope);
  }
  await addRecord('preference','note-1',{value:'catatan lokal'},scope).catch(()=>{});
  const source=await fingerprint(scope);
  suite.check('fixture-volume',`${SESSIONS} sessions × 50 questions from MM-G12-L05-MIX-P001 plus 6 mixed sessions`,()=>{
    if(source.attempts!==SESSIONS+6)throw Error(JSON.stringify(source));
    if(SESSIONS===250&&source.events<13000)throw Error('expected ≥13.000 events, got '+source.events);
    return {attempts:source.attempts,events:source.events,generate_ms:Math.round(performance.now()-started)};
  });
  await suite.checkAsync('format1-limit-reproduced','Single-file format 1 still refuses this profile (original 50 MiB limit kept, TECH-01 reproduced)',async()=>{
    try{await exportBackup(scope);}catch(e){if(e.code==='BACKUP_TOO_LARGE')return e.code;throw e;}
    if(SESSIONS>=150)throw Error('format 1 unexpectedly exported');return 'not reached at this volume';
  });
  let archive;
  await suite.checkAsync('archive-export','Format-2 archive exported with manifest, parts and checksums',async()=>{
    const t=performance.now();const progress=[];
    archive=await exportArchive(scope,{onProgress:p=>progress.push(p.phase),app_version:'1.3.0'});
    const m=await readArchive(archive);
    if(m.archive.parts<2)throw Error('expected several parts, got '+m.archive.parts);
    await writeFile(join(dir,'archive.zip'),Buffer.from(await archive.arrayBuffer()));
    return {bytes:archive.size,parts:m.archive.parts,ms:Math.round(performance.now()-t),progress_events:progress.length};
  });
  await writeFile(join(dir,'source.json'),JSON.stringify(source));
  // Phase 2 runs in a new process: its storage starts empty.
  const child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'restore',dir],{encoding:'utf8',maxBuffer:64*1024*1024,env:process.env});
  let restored=null;try{restored=JSON.parse(child.stdout.trim().split('\n').at(-1));}catch{}
  suite.check('restore-process','Restore phase ran in a separate process with empty storage',()=>{if(child.status!==0||!restored||!restored.empty_before)throw Error((child.stderr||child.stdout).slice(-2000));return {exit:child.status,empty_before:restored.empty_before};});
  for(const c of restored?.checks||[])suite.checks.push(c);
  suite.check('restore-identical','Attempt IDs, event IDs, payload hashes, order, raw answers, locale, first/final correctness, status and metrics identical',()=>{
    const r=restored?.fingerprint;if(!r)throw Error('no fingerprint');
    for(const k of ['attempts','events','attempt_rows_sha256','event_rows_sha256','detail_sha256','ledger_sha256'])if(r[k]!==source[k])throw Error(k+' differs');
    return {attempts:r.attempts,events:r.events,detail_sha256:r.detail_sha256,sample_raw:r.sample_raw};
  });
  suite.finish(receiptPath('data-large-backup.json'),{archive_bytes:archive?.size??null,limits:ARCHIVE});
}

if(phase==='restore'){
  const dir=process.argv[3];const out={checks:[]};
  const rec=(id,expected,ok,actual)=>out.checks.push({id,status:ok?'PASS':'FAIL',expected,actual});
  const tryCode=async fn=>{try{await fn();return 'NO_ERROR';}catch(e){return e instanceof DOMException?e.name:(e.code||e.name||e.message);}};
  const bytes=await readFile(join(dir,'archive.zip'));const blob=new Blob([bytes],{type:'application/zip'});
  const source=JSON.parse(await readFile(join(dir,'source.json'),'utf8'));
  const backup=await readArchive(blob);const scope=scopeForLocal(backup.profile.id);
  out.empty_before=(await listAttempts(scope)).length===0&&(await listEvents(null,scope)).length===0&&!(await listProfiles()).some(p=>p.id===backup.profile.id);
  // Corruption, missing and duplicate parts, wrong owner, zip bomb: rejected before any write.
  const {readZipIndex,writeZip}=await import('../../src/data/archive.js');
  const entries=await readZipIndex(blob,{allowed:()=>true});
  const flip=new Uint8Array(bytes);const p1=entries.get('parts/part-00001.json');flip[p1.local+30+p1.name.length+40]^=0xff;
  rec('corrupt-part','A changed byte inside a part is rejected',(await tryCode(()=>readAny(new Blob([flip]))))!=='NO_ERROR',await tryCode(()=>readAny(new Blob([flip]))));
  const dec=new TextDecoder();
  const files=[];for(const [name,e] of entries){const {readEntry}=await import('../../src/data/archive.js');files.push({name,bytes:await readEntry(blob,e,{limit:64*1024*1024})});}
  const without=await writeZip(files.filter(f=>f.name!=='parts/part-00002.json'));
  rec('missing-part','An archive without one listed part is rejected',(await tryCode(()=>readAny(without)))==='ARCHIVE_PART_MISSING',await tryCode(()=>readAny(without)));
  const dup=await writeZip([...files,{name:'parts/part-00002.json',bytes:files.find(f=>f.name==='parts/part-00002.json').bytes}]);
  rec('duplicate-part','Duplicate entry names are rejected',(await tryCode(()=>readAny(dup)))==='INVALID_ARCHIVE',await tryCode(()=>readAny(dup)));
  const extra=await writeZip([...files,{name:'parts/part-99999.json',bytes:new TextEncoder().encode('{}')}]);
  rec('unlisted-part','A part not listed in the manifest is rejected',(await tryCode(()=>readAny(extra)))==='INVALID_BACKUP',await tryCode(()=>readAny(extra)));
  // Wrong owner: a part relabelled to another profile, with manifest re-signed by the attacker.
  {
    const {sha256}=await import('../../src/data/common.js');
    const mf=JSON.parse(dec.decode(files.find(f=>f.name==='manifest.json').bytes));
    const pf=files.find(f=>f.name==='parts/part-00001.json');const part=JSON.parse(dec.decode(pf.bytes));part.profile_id='someone-else';
    const nb=new TextEncoder().encode(JSON.stringify(part));mf.parts[0].sha256=await sha256(nb);mf.parts[0].bytes=nb.length;
    const {checksum,...body}=mf;const {canonical:c}=await import('../../src/data/common.js');mf.checksum=await sha256(c(body,false));
    const forged=await writeZip(files.map(f=>f.name==='manifest.json'?{name:f.name,bytes:new TextEncoder().encode(JSON.stringify(mf))}:f.name===pf.name?{name:f.name,bytes:nb}:f));
    const code=await tryCode(()=>readAny(forged));rec('wrong-owner','A part belonging to another profile is rejected',code==='INVALID_BACKUP',code);
  }
  {
    // Zip bomb: a manifest entry declaring a huge decompressed size is refused before inflating.
    const big=new Uint8Array(ARCHIVE.max_part+1024);big.fill(32);
    const bomb=await writeZip([files.find(f=>f.name==='manifest.json'),{name:'parts/part-00001.json',bytes:big},...files.filter(f=>f.name.startsWith('parts/')&&f.name!=='parts/part-00001.json')]);
    const code=await tryCode(()=>readAny(bomb));rec('decompression-limit','A part larger than its declared/limited size is refused',['ARCHIVE_TOO_LARGE','CHECKSUM_MISMATCH','INVALID_BACKUP'].includes(code),code);
  }
  // Cancellation leaves storage empty.
  {
    const ctl=new AbortController();const pending=importBackup(blob,{signal:ctl.signal});ctl.abort();
    const code=await pending.then(()=>'NO_ERROR',e=>e instanceof DOMException?e.name:(e.code||e.name));
    rec('cancel-before-commit','Cancelling the import writes nothing',code==='AbortError'&&(await listAttempts(scope)).length===0,{code,attempts:(await listAttempts(scope)).length});
  }
  const preview=await previewBackup(blob);
  rec('preview','Preview counts additions without writing',preview.conflicts.length===0&&preview.additions===1+source.attempts+source.events+backup.records.records.length&&(await listAttempts(scope)).length===0,{additions:preview.additions,sessions:preview.sessions});
  const t=performance.now();const first=await importBackup(blob);
  rec('import','Import restores every row in one transaction',first.additions===preview.additions,{additions:first.additions,ms:Math.round(performance.now()-t)});
  const again=await importBackup(blob);
  rec('idempotent','A second import adds nothing and reports duplicates',again.additions===0&&again.duplicates===first.additions,{additions:again.additions,duplicates:again.duplicates});
  out.fingerprint=await fingerprint(scope);
  // Conflict: same IDs with different content block the restore and keep device data.
  {
    const mf=JSON.parse(dec.decode(files.find(f=>f.name==='manifest.json').bytes));
    const {sha256,canonical:c}=await import('../../src/data/common.js');
    const pf=files.find(f=>f.name==='parts/part-00001.json');const part=JSON.parse(dec.decode(pf.bytes));
    // Change a stored record value that has no hash of its own: the restore must refuse to overwrite it.
    const target=part.records.attempts[0];target.data.ui_paused=!target.data.ui_paused;
    const nb=new TextEncoder().encode(JSON.stringify(part));mf.parts[0].sha256=await sha256(nb);mf.parts[0].bytes=nb.length;
    const {checksum,...body}=mf;mf.checksum=await sha256(c(body,false));
    const changed=await writeZip(files.map(f=>f.name==='manifest.json'?{name:f.name,bytes:new TextEncoder().encode(JSON.stringify(mf))}:f.name===pf.name?{name:f.name,bytes:nb}:f));
    const code=await tryCode(()=>importBackup(changed));const after=await fingerprint(scope);
    rec('conflict-blocked','Differing content for an existing ID blocks the restore; device rows unchanged',['IMPORT_CONFLICT','INVALID_BACKUP_ATTEMPT','INVALID_BACKUP_EVENT'].includes(code)&&after.detail_sha256===out.fingerprint.detail_sha256,code);
  }
  // Format 1 compatibility: the historical v1.0 profile backup still restores.
  {
    const legacy=await readFile(new URL('../upgrade/fixtures/profile-v1.0.0.json',import.meta.url),'utf8');
    const r=await importBackup(new Blob([legacy],{type:'application/json'}));const b=await readBackup(legacy);
    rec('format1-compatible','Historical format-1 backup (v1.0.0 fixture) restores',r.conflicts.length===0&&(await listAttempts(scopeForLocal(b.profile.id))).length===b.records.attempts.length,{additions:r.additions});
  }
  console.log(JSON.stringify(out));
}
