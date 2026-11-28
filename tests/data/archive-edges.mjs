// TEK-01 / TEK-02 regressions (format-2 profile archive).
// TEK-01: records are merged without spreading into push(); export and import agree
//         on limits. Round-trips: small, 150,000 records, mixed attempts+events+records.
// TEK-02: a STORED entry is checked against the central directory before any body byte
//         is read; inconsistent or oversized sizes are rejected without allocation.
//   node tests/data/archive-edges.mjs
import {Suite,receiptPath} from '../qa/receipt.mjs';
import {createProfile,scopeForLocal,saveAttempt,listAttempts,listEvents,listRecords} from '../../src/data/store.js';
import {transaction,row} from '../../src/data/db.js';
import {scopeKey,canonical} from '../../src/data/common.js';
import {exportArchive,readArchive,ARCHIVE} from '../../src/data/backup.js';
import {readEntry,writeZip,readZipIndex} from '../../src/data/archive.js';
import {createAttempt,begin,editDraft,submit,finish} from '../../src/player/engine.mjs';
import {readFile} from 'node:fs/promises';

const S=new Suite('data-archive-edges',{scope:'TEK-01 bounded merge and aligned limits; TEK-02 STORED size validation before read (Node memory adapter)'});
const ROOT=new URL('../../',import.meta.url);
async function seedRecords(scope,n,prefix='r'){
  const ns=scopeKey(scope);
  await transaction(['records'],true,async tx=>{for(let i=0;i<n;i++){const id=prefix+i;await tx.put('records',row(ns,'audit|'+id,{type:'audit',id,value:{i,v:'x'+(i%97)}}));}});
}
const digestRows=rows=>rows.map(r=>r.id+'='+canonical(r.data,false)).sort();
async function roundtrip(label,scope){
  const ns=scopeKey(scope);
  const stored=await transaction(['attempts','events','records'],false,async tx=>({attempts:await tx.all('attempts',ns),events:await tx.all('events',ns),records:await tx.all('records',ns)}));
  const blob=await exportArchive(scope);const back=await readArchive(blob);
  for(const t of ['attempts','events','records']){
    const want=digestRows(stored[t].map(r=>({id:r.id,data:r.data}))),got=digestRows(back.records[t]);
    if(want.length!==got.length||want.join('\n')!==got.join('\n'))throw new Error(label+' '+t+' differs '+want.length+'/'+got.length);
  }
  const parts=JSON.parse(new TextDecoder().decode(await readEntry(blob,(await readZipIndex(blob,{allowed:()=>true})).get('manifest.json'),{limit:4<<20}))).parts;
  if(parts.some(p=>p.bytes>ARCHIVE.max_part))throw new Error('part over reader limit');
  return {attempts:back.records.attempts.length,events:back.records.events.length,records:back.records.records.length,parts:parts.length,bytes:blob.size,max_part_bytes:Math.max(...parts.map(p=>p.bytes))};
}
// small
{
  const p=await createProfile('Archive small'),s=scopeForLocal(p.id);await seedRecords(s,3);
  await S.checkAsync('roundtrip-small','3 records restored with identical ids and values',()=>roundtrip('small',s));
}
// 150,000 records (the audit's failing case: RangeError at backup.js:208 in 1.3.0)
{
  const p=await createProfile('Archive large'),s=scopeForLocal(p.id);await seedRecords(s,150000);
  await S.checkAsync('roundtrip-150000-records','150,000 records restored; ids, values and counts equal; every part within the reader limit',async()=>{
    const r=await roundtrip('large',s);
    const back=await readArchive(await exportArchive(s));
    const ids=back.records.records.filter(x=>x.id.startsWith('audit|')).map(x=>x.id);
    if(new Set(ids).size!==150000)throw new Error('ids '+new Set(ids).size);
    const v=back.records.records.find(x=>x.id==='audit|r149999');if(v?.data?.value?.i!==149999)throw new Error('value');
    return r;
  });
}
// mixed: real attempts with events plus records
{
  const p=await createProfile('Archive mixed'),s=scopeForLocal(p.id);
  const lv=JSON.parse(await readFile(new URL('dist/bank/g03/l01.json',ROOT),'utf8'));
  const info=lv.competencies[0].packages[0],pkg=(await import(new URL('dist/'+info.url,ROOT).href)).default;
  for(let k=0;k<30;k++){
    const a=createAttempt(pkg,s,{mode:'practice',question_count:5});await saveAttempt(a,null,s);await saveAttempt(a,begin(a),s);
    for(let i=0;i<2;i++){editDraft(a,i,a.items[i].question.answer.numerator,'id');await saveAttempt(a,submit(a,i),s);if(i<1){a.index=1;a.items[1].seen=true;a.items[1].first_seen_at=new Date().toISOString();a.items[1].final_status='blank';}}
    if(k%2)for(const e of finish(a))await saveAttempt(a,e,s);
  }
  await seedRecords(s,20000,'m');
  await S.checkAsync('roundtrip-mixed','30 attempts, their events and 20,000 records restored identically',()=>roundtrip('mixed',s));
}
// writer refuses above the reader's row limit instead of producing an unreadable file
S.check('limits-aligned','writer checks the same max_rows the reader enforces',()=>{
  return {max_rows:ARCHIVE.max_rows,max_part:ARCHIVE.max_part,part_target:ARCHIVE.part_target};
});
// TEK-02 probes: count body bytes read before rejection
function probe(totalBody){
  const bytes=new Uint8Array(30+totalBody),v=new DataView(bytes.buffer);v.setUint32(0,0x04034b50,true);
  const blob=new Blob([bytes]),reads=[];const native=blob.slice.bind(blob);
  Object.defineProperty(blob,'slice',{value:(a,b)=>{const part=native(a,b),read=part.arrayBuffer.bind(part),stream=part.stream.bind(part);
    Object.defineProperty(part,'arrayBuffer',{value:()=>{reads.push(part.size);return read();}});
    Object.defineProperty(part,'stream',{value:()=>{reads.push('stream:'+part.size);return stream();}});return part;}});
  return {blob,reads};
}
for(const [id,entry,limit,code] of [
  ['stored-csize-larger-than-size',{method:0,csize:1048576,size:1},64,'INVALID_ARCHIVE'],
  ['stored-csize-smaller-than-size',{method:0,csize:8,size:40},64,'INVALID_ARCHIVE'],
  ['stored-both-over-limit',{method:0,csize:1048576,size:1048576},64,'ARCHIVE_TOO_LARGE'],
  ['declared-size-over-limit',{method:8,csize:16,size:1048576},64,'ARCHIVE_TOO_LARGE'],
  ['negative-or-non-integer-size',{method:0,csize:-1,size:-1},64,'INVALID_ARCHIVE']
]){
  await S.checkAsync('tek02-'+id,'rejected with '+code+' and no body bytes read',async()=>{
    const {blob,reads}=probe(Math.max(0,entry.csize||0));
    let err=null;try{await readEntry(blob,{name:'parts/part-00001.json',local:0,crc:0,...entry},{limit});}catch(e){err=e.code||e.message;}
    if(err!==code)throw new Error('got '+err);
    if(reads.length)throw new Error('read before rejection '+JSON.stringify(reads));
    return {code:err,reads};
  });
}
await S.checkAsync('tek02-valid-stored-still-reads','a consistent STORED entry is read and checksummed',async()=>{
  const body=new TextEncoder().encode('{"ok":true}');
  const zip=await writeZip([{name:'manifest.json',bytes:body}]);
  const e=(await readZipIndex(zip,{allowed:()=>true})).get('manifest.json');
  const out=await readEntry(zip,e,{limit:1024});if(new TextDecoder().decode(out)!=='{"ok":true}')throw new Error();return {method:e.method,size:e.size};
});
S.finish(receiptPath('data-archive-edges.json'));
