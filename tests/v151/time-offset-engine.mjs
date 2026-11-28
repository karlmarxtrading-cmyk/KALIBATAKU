// A new Node process (and empty local storage adapter) per representation.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=resolve(root,'evidence/v151/time');
const groups=[['z',0],['plus07',420],['plus08',480],['minus05',-300],['mixed',null]];
const zones=[['UTC',0],['Asia/Jakarta',7],['Asia/Makassar',8],['Asia/Jayapura',9]];
const file=async p=>readFile(resolve(root,p));
const json=async p=>JSON.parse(await file(p));
const checks=[];
function check(name,actual,expected){assert.deepEqual(actual,expected,name);checks.push({name,actual,expected});}
if(!process.argv[2]){
  await mkdir(out,{recursive:true});
  for(const [name] of groups){
    const child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),name],{encoding:'utf8'});
    if(child.status!==0)throw new Error(child.stderr||child.error||name);
  }
  const reports=await Promise.all(groups.map(([name])=>readFile(resolve(out,name,'checks.json'),'utf8').then(JSON.parse)));
  const release=(await json('dist/offline-assets.json')).release;
  await writeFile(resolve(out,'engine.json'),JSON.stringify({status:'PASS',release,node:process.version,
    comparison:'Fixed expected 4 sessions, 32 items, 3 missions. Fresh JSON and ZIP imports. All window and ordering expectations are independent.',
    checks:reports.reduce((sum,r)=>sum+r.checks.length,0),groups:reports.map(r=>({name:r.name,checks:r.checks.length,zone_order:r.zone_order}))},null,2)+'\n');
  console.log('PASS AUD15-03 time-offset-engine',reports.reduce((s,r)=>s+r.checks.length,0),'checks, 5 JSON and 5 ZIP restores');
}else{
  const name=process.argv[2],i=groups.findIndex(x=>x[0]===name),minutes=groups[i][1];
  const caseOut=resolve(out,name);await mkdir(caseOut,{recursive:true});
  const load=p=>import(pathToFileURL(resolve(root,'dist',p)));
  const {epoch}=await load('data/time.js');
  const {sha256,canonical,eventHash}=await load('data/common.js');
  const {readBackup,previewBackup,importBackup,exportArchive}=await load('data/backup.js');
  const {listAttempts,listEvents,scopeForLocal,deleteProfile,queryAttemptSummaries}=await load('data/store.js');
  const {buildSnapshot,initialFilters,filterSessions,periodBounds,dateAt}=await load('teacher/report.js');
  const {encode}=await load('teacher/export/index.js');
  const seed=await json('tests/journey/fixtures/report-audit-04-v14.json');
  const formatted=(ms,delta)=>{
    const local=new Date(ms+delta*60000).toISOString();if(delta===0)return local;
    const sign=delta<0?'-':'+',amt=Math.abs(delta);return local.slice(0,-1)+sign+String(Math.floor(amt/60)).padStart(2,'0')+':'+String(amt%60).padStart(2,'0');
  };
  function change(value,delta){
    if(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value))return formatted(Date.parse(value)+12*3600000,delta);
    if(Array.isArray(value))return value.map(x=>change(x,delta));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,change(v,delta)]));
    return value;
  }
  // Construct independent signed fixtures BEFORE import. From this point on the
  // candidate must retain every stored raw timestamp, payload and hash unchanged.
  const bundles=seed.bundles.map((b,k)=>change(b,minutes??[-300,480,0,420][k]));
  for(const b of bundles)for(const e of b.events)e.payload_hash=await eventHash(e);
  const body={format:'kalibataku-profile-backup',schema_version:'1.0.0',release_id:'kalibataku-static-1',
    data_origin:'local_practice',exported_at:'2026-11-29T00:00:00Z',verification_status:'unverified',
    profile:{id:seed.profile_id,name:'Audit zona waktu'},records:{attempts:bundles.map(b=>({id:b.attempt.attempt_id,data:b.attempt})),
    events:bundles.flatMap(b=>b.events.map(e=>({id:e.event_id,data:e}))),records:[]}};
  const backup={...body,checksum:await sha256(canonical(body,false))};
  const scope=scopeForLocal(seed.profile_id),person={id:seed.profile_id,alias:'Audit zona waktu',classId:'A'};
  const filters={...initialFilters(),source:'local_practice',from:'2026-11-28',to:'2026-11-28'};
  const at='2026-11-29T12:00:00Z',ordered=seed.bundles.map(b=>b.attempt.attempt_id).reverse();
  const expectedBounds=[bundles[0].attempt.started_at,bundles.at(-1).attempt.started_at];
  const snapshot=(attempts,f,notes=[])=>buildSnapshot({person,people:[person],filters:f,attempts,notes,createdAt:at,locale:'id',appendix:true});
  async function verifyRestore(input,label){
    const before=await previewBackup(input);
    check(label+' preview chronology',[before.first_date,before.last_date],expectedBounds);
    const saved=await importBackup(input);assert(saved.additions>=4);
    const attempts=await listAttempts(scope),events=await listEvents(null,scope);
    check(label+' store order',attempts.map(a=>a.attempt_id),ordered);
    const original=bundles.map(b=>b.attempt).sort((a,b)=>a.attempt_id.localeCompare(b.attempt_id));
    const loaded=[...attempts].sort((a,b)=>a.attempt_id.localeCompare(b.attempt_id));
    check(label+' snapshot hash',await sha256(canonical(loaded,false)),await sha256(canonical(original,false)));
    const eventRows=bundles.flatMap(b=>b.events).sort((a,b)=>a.attempt_id.localeCompare(b.attempt_id)||a.event_sequence-b.event_sequence);
    check(label+' complete timestamp and event-payload hash',await sha256(canonical(events,false)),await sha256(canonical(eventRows,false)));
    const page=await queryAttemptSummaries(scope,{since:expectedBounds[0]});
    check(label+' compact index order',page.rows.map(a=>a.attempt_id),ordered);
    return attempts;
  }
  const inputBackup=name==='plus07'?await json('tests/v151/fixtures/timezone-offset-valid-backup.json'):backup;
  if(name==='plus07')check('exact audit archive records',await sha256(canonical(inputBackup.records,false)),await sha256(canonical(backup.records,false)));
  await verifyRestore(inputBackup,'JSON');
  const zip=await exportArchive(scope);await deleteProfile(scope.profileId);
  check('empty before ZIP restore',(await listAttempts(scope)).length,0);
  const attempts=await verifyRestore(zip,'ZIP');
  const font=[await file('dist/teacher/font/DejaVuSans.ttf'),await json('dist/teacher/font/metrics.json')];
  const date='2026-11-28',msDay=864e5;
  const matching=minutes??-300;
  for(const [zone,offset] of zones){
    const f={...filters,timezone:zone},expectedStart=Date.UTC(2026,10,28)-offset*3600000,expectedEnd=expectedStart+msDay;
    check(zone+' actual boundaries',periodBounds(f),[expectedStart,expectedEnd].map(t=>new Date(t).toISOString()));
    for(const [label,instant,included] of [['S-1',expectedStart-1,0],['S',expectedStart,1],['S+1',expectedStart+1,1],
      ['E-1',expectedEnd-1,1],['E',expectedEnd,0],['E+1',expectedEnd+1,0]]){
      const a={...attempts[0],started_at:formatted(instant,matching)};
      check(zone+' '+label,filterSessions([a],[person],f).length,included);
    }
    const inst=expectedStart+3600000,atTime=(id,n,delta)=>({id,profileId:person.id,at:formatted(n,delta),
      type:'note',revision:1,author:'QA',text:'Catatan '+id});
    const notes=[atTime('Z',inst,-300),atTime('B',expectedStart,480),atTime('A',inst,480),atTime('OUT',expectedEnd,-300),
      atTime('LAST',expectedEnd-1,-300),atTime('EARLY',expectedStart-1,480)];
    const report=snapshot(attempts,f,notes);
    check(zone+' report values',[report.completed,report.core.assigned_count,report.core.correct_count,report.journey.missions,report.sessions.map(s=>s.id)],
      [4,32,32,3,ordered]);
    check(zone+' notes boundaries, epoch order and ID ties',report.notes.map(n=>n.id),['B','A','Z','LAST']);
    check(zone+' stable ties',filterSessions([{...attempts[0],attempt_id:'z',started_at:formatted(inst,-300)},
      {...attempts[0],attempt_id:'a',started_at:formatted(inst,480)}],[person],f).map(a=>a.attempt_id),['a','z']);
    const cutoff=[...attempts];cutoff[0]={...cutoff[0],completed_at:formatted(expectedEnd,matching)};
    const last=snapshot(cutoff,f);check(zone+' finalization exactly at cutoff',[last.completed,last.ongoing,last.journey.missions],[3,1,2]);
    if(zone===zones[i%4][0]){
      for(const format of ['json','csv','xlsx','docx','pdf']){
        await writeFile(resolve(caseOut,'report.'+format),await encode(report,format,{font}));
      }
    }
  }
  const invalid=['2026-02-30T12:00:00Z','2026-11-28T12:00:00','2026-11-28T12:00:00+55:00','garbage',null];
  for(const ts of invalid){
    check('invalid timestamp '+String(ts),Number.isNaN(epoch(ts)),true);
    check('invalid session excluded '+String(ts),filterSessions([{...attempts[0],started_at:ts}],[person],filters).length,0);
  }
  assert.throws(()=>periodBounds({...filters,from:'2026-02-30'}),/RANGE/);
  assert.throws(()=>snapshot(attempts,{...filters,timezone:'not-a-zone'}),/RANGE/);
  check('invalid display',dateAt('garbage','UTC','en'),'—');
  const broken=structuredClone(backup);broken.records.attempts[0].data.started_at='2026-11-28T12:00:00';delete broken.checksum;
  broken.checksum=await sha256(canonical(broken,false));
  await assert.rejects(()=>readBackup(broken),/INVALID_BACKUP/);
  check('invalid restore leaves data',await sha256(canonical(await listAttempts(scope),false)),await sha256(canonical(attempts,false)));
  check('historical zone midnight Jakarta 1935',periodBounds({...filters,timezone:'Asia/Jakarta',from:'1935-11-28',to:'1935-11-28'})[0],'1935-11-27T16:30:00.000Z');
  check('historical zone midnight Makassar 1943',periodBounds({...filters,timezone:'Asia/Makassar',from:'1943-11-28',to:'1943-11-28'})[0],'1943-11-27T15:00:00.000Z');
  check('historical zone midnight Jayapura 1947',periodBounds({...filters,timezone:'Asia/Jayapura',from:'1947-11-28',to:'1947-11-28'})[0],'1947-11-27T14:30:00.000Z');
  await writeFile(resolve(caseOut,'checks.json'),JSON.stringify({name,checks,zone_order:zones.map(([z])=>z),export_zone:zones[i%4][0]},null,2)+'\n');
}
