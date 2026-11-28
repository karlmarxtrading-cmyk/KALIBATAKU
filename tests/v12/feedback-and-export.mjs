import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {begin,createAttempt,editDraft,submit,finish,noteHint} from '../../src/player/engine.mjs';
import {createProfile,scopeForLocal,saveAttempt,listEvents} from '../../src/data/store.js';
import {readBackup,exportBackup} from '../../src/data/backup.js';
import {buildSnapshot,initialFilters} from '../../src/teacher/report.js';
import {documentModel} from '../../src/teacher/document.js';
import {encode} from '../../src/teacher/export/index.js';
const root=new URL('../../',import.meta.url),out=new URL('evidence/v12/reports/',root);
await fs.mkdir(out,{recursive:true});
const pkg=(await import(new URL('dist/bank/v1.2/g05/l03/MM-G05-L03-ADD-P001.mjs',root))).default;
const scope=scopeForLocal((await createProfile('Fixture pecahan')).id);
const person={id:scope.profileId,alias:'Fixture pecahan',classId:''};
const reports=[];
for(const mode of ['practice','adaptive','recovery','speed','assessment']){
  const a=createAttempt(pkg,scope,{mode,question_count:1});
  await saveAttempt(a,begin(a),scope);
  if(mode==='adaptive')noteHint(a,0);
  editDraft(a,0,'99','id');const initial=submit(a,0);
  await saveAttempt(a,initial,scope);
  editDraft(a,0,'21/12','id');const second=submit(a,0);
  await saveAttempt(a,second,scope);
  await saveAttempt(a,finish(a),scope);
  const rows=await listEvents(a.attempt_id,scope),answers=rows.filter(e=>e.event_type==='answer.submitted');
  assert.equal(answers.length,2);assert.equal(answers[0].payload.key_seen_before,false);
  assert.equal(answers[0].payload.hint_before,mode==='adaptive');assert.equal(answers[1].payload.key_seen_before,mode!=='assessment');
  assert.equal(answers[0].payload.raw_answer,'99');assert.equal(answers[1].payload.raw_answer,'21/12');
  assert.equal(answers[1].payload.answer.numerator,'7');assert.equal(a.items[0].first_correct,false);assert.equal(a.items[0].final_correct,true);
  reports.push({mode,events:rows.map(r=>({id:r.event_id,type:r.event_type})),answers:answers.map(r=>r.payload)});
  if(mode==='practice'){
    const snap=buildSnapshot({person,people:[person],attempts:[a],filters:{...initialFilters(),source:'local_practice'},notes:[],locale:'id',plan:'Periksa penyebut bersama.',reviewDate:'2026-12-01'});
    assert.equal(snap.firstDifficulty.after_key,true);assert.equal(snap.contexts[0].independent,0);
    const math=documentModel(snap).blocks.filter(x=>x.kind==='math');assert.equal(math[0].text,'Soal · 11/12 + 10/12');assert.equal(math[1].text,'Kunci jawaban · 7/4');
    const font=[await fs.readFile(new URL('src/teacher/font/DejaVuSans.ttf',root)),JSON.parse(await fs.readFile(new URL('src/teacher/font/metrics.json',root)))];
    for(const format of ['pdf','docx','csv','xlsx','json'])await fs.writeFile(new URL('pecahan.'+format,out),await encode(snap,format,{font}));
  }
}
const backup=await readBackup(await exportBackup(scope));assert.equal(backup.records.attempts.length,5);assert.equal(backup.records.events.length,20);
await fs.writeFile(new URL('feedback-ledger.json',out),JSON.stringify({engine:process.version,profile:'synthetic',expected:'first wrong, final correct, independent count zero; evaluation has no early reveal; ID and exact fractions persist',status:'PASS',backupEvents:20,modes:reports},null,2));
console.log('Five real modes and event-schema, backup and export checks passed.');
