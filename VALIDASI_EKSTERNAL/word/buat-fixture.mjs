// Regenerates synthetic controls from the actual distribution and local bank.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createAttempt,begin,editDraft,submit,finish} from '../../dist/player/engine.mjs';
import {saveAttempt,createProfile,scopeForLocal} from '../../dist/data/store.js';
import {exportBackup,readBackup} from '../../dist/data/backup.js';
import {buildSnapshot,initialFilters} from '../../dist/teacher/report.js';
import {documentModel} from '../../dist/teacher/document.js';
import {encode} from '../../dist/teacher/export/index.js';
import {mathML} from '../../dist/math/model.mjs';
const local=n=>new URL(n,import.meta.url);
const load=async n=>JSON.parse(await readFile(local(n)));
const font=[await readFile(local('../../dist/teacher/font/DejaVuSans.ttf')),await load('../../dist/teacher/font/metrics.json')];
const release=(await load('../../dist/offline-assets.json')).release;
const build=await load('../../dist/build-info.json');
const proof={build,offline_release:release,generated_at_utc:new Date().toISOString(),fixture_kind:'latihan profil sintetis',target_word_review:'BELUM_DIUJI',documents:[]};
const cases=[
  {name:'fixture-pecahan', grade:'05',level:'03',op:'ADD',index:0,revised:'21/12',expectedKey:'7/4'},
  {name:'fixture-kurung-minus',grade:'11',level:'03',op:'MIX',index:1,revised:'14/3',expectedKey:'14/3'}
];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const html=['<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rujukan persamaan untuk Word</title><style>body{font:17px/1.6 system-ui;max-width:50rem;margin:3rem auto;padding:0 1.2rem;color:#172e36}math{font-size:1.4rem}li{margin-block:1rem}code{overflow-wrap:anywhere}</style><main><h1>Rujukan persamaan untuk Word</h1><p>Cocokkan setiap baris dengan dokumen Word dan PDF pasangannya. Tentukan hasil dari tampilan aplikasi Word yang digunakan sekolah.</p>'];
const write=async(name,bytes)=>{await writeFile(local(name),bytes);return {name,sha256:hash(bytes)};};
for(const c of cases){
  const id='MM-G'+c.grade+'-L'+c.level+'-'+c.op+'-P001';
  const pkg=(await import('../../dist/bank/v1.2/g'+c.grade+'/l'+c.level+'/'+id+'.mjs')).default;
  const q=pkg.questions[c.index];
  assert.equal(q.answer.numerator+'/'+q.answer.denominator,c.expectedKey);
  const profile=await createProfile('Demo uji '+c.name),scope=scopeForLocal(profile.id);
  const a=createAttempt(pkg,scope,{mode:'practice',items:[{question:q}],seed:200+Number(c.grade)});
  await saveAttempt(a,begin(a),scope);
  editDraft(a,0,'99','id');await saveAttempt(a,submit(a,0),scope);
  editDraft(a,0,c.revised,'id');await saveAttempt(a,submit(a,0),scope);
  await saveAttempt(a,finish(a),scope);
  assert(a.items[0].final_correct&&!a.items[0].first_correct);
  const person={id:profile.id,classId:'',alias:profile.name};
  const snap=buildSnapshot({person,people:[person],attempts:[a],filters:{...initialFilters(),source:'local_practice'},locale:'id'});
  const blocks=documentModel(snap).blocks.filter(b=>b.kind==='math');
  assert.equal(blocks.length,4);
  const bytes=await exportBackup(scope);await readBackup(bytes);
  const archiveData=JSON.stringify(bytes,null,2)+'\n';
  const saved=[await write(c.name+'-profil-sintetis.json',archiveData)];
  for(const format of ['docx','pdf'])saved.push(await write(c.name+'.'+format,await encode(snap,format,{font})));
  proof.documents.push({name:c.name,package_id:id,question_index:c.index,question_id:q.question_id,canonical:q.neutral_expression,
    expected_fractions_and_signs:q.expression_ast,first_response:'99',revised_response:c.revised,canonical_key:c.expectedKey,
    rows:blocks.map(b=>({label:b.label,readable:b.text,tokens:b.math})),files:saved});
  html.push('<section><h2>'+c.name+'</h2><p><a href="'+c.name+'.docx">Word</a> · <a href="'+c.name+'.pdf">PDF</a></p><ol>');
  for(const b of blocks)html.push('<li>'+b.label+'<br>'+mathML(b.math)+'</li>');
  html.push('</ol></section>');
}
html.push('</main></html>');
await writeFile(local('rujukan.html'),html.join('\n'));
await writeFile(local('rujukan.json'),JSON.stringify(proof,null,2)+'\n');
console.log(proof.documents.map(d=>d.name+': '+d.rows.map(r=>r.readable).join(' | ')).join('\n'));
