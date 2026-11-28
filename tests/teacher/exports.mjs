import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {buildSnapshot,initialFilters,filterSessions,sumCounts,nextStep,periodBounds} from '../../src/teacher/report.js';
import {documentModel,fileStem} from '../../src/teacher/document.js';
import {encode,batch} from '../../src/teacher/export/index.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=path.join(root,'evidence/teacher/exports');
await fs.mkdir(out,{recursive:true});
const font=[new Uint8Array(await fs.readFile(path.join(root,'src/teacher/font/DejaVuSans.ttf'))),JSON.parse(await fs.readFile(path.join(root,'src/teacher/font/metrics.json')))];
const subjects=[{id:'demo-01',alias:'Demo Éka, "Arum"',classId:'3A'},{id:'demo-02',alias:'Demo 02',classId:'4B'}];
const initial=initialFilters(),who=subjects[0],when='2026-11-25T12:05:00Z';
function form(c,w,sk=0,b=0,u=0,extra={}) {
  const records=['correct','incorrect','skipped','blank','unseen'].flatMap((status,i)=>Array.from({length:[c,w,sk,b,u][i]},(_,j)=>{
    const answer=(j+2)*4,raw=status==='correct'?answer:status==='incorrect'?answer-1:'';
    return {question_instance_id:'inst-'+status+j,question:{competency_id:'arithmetic.multiplication.g03.l02',fingerprint:status+j,neutral_expression:(j+2)+' × 4',answer:{numerator:String(answer),denominator:'1'}},
      final_status:status,seen:status!=='unseen',draft:String(raw),hint_used:false,history:raw===''?[]:[{is_correct:status==='correct',raw_answer:String(raw),submission_kind:'initial'}]};
  }));
  return {profile_id:who.id,data_origin:'demo',module_id:'mental-math',status:'completed',attempt_id:crypto.randomUUID(),grade:3,level:2,operation:'MUL',form_family_id:'test-family',form_id:'A',content_version:'1.0.0',policy_version:'mastery-local-v1',
    package_id:'TEST-MUL',mode:'assessment',target_competency_id:'arithmetic.multiplication.g03.l02',assessment_cycle_id:'test-cycle',started_at:'2026-11-05T01:00:00.000Z',completed_at:'2026-11-05T01:01:00.000Z',items:records,...extra};
}
function snap(attempts,locale='id',person=who,filters=initial,notes=[]){return buildSnapshot({person,people:subjects,attempts,locale,filters,createdAt:when,notes,appendix:true});}
const a=form(14,3,2,1),b=form(5,0,0,5),c=[form(9,1),form(50,50)],d=form(1,0,0,0,0,{mode:'practice'});
d.items[0].history=[{is_correct:false,raw_answer:'92',submission_kind:'initial'},{is_correct:true,raw_answer:'96',submission_kind:'retry',hint_used:true}];d.items[0].hint_used=true;d.items[0].question.neutral_expression='24 × 4';d.items[0].question.answer.numerator='96';
const e=[form(29,21),form(43,7,0,0,0,{form_id:'B',started_at:'2026-11-07T01:00:00.000Z',completed_at:'2026-11-07T01:01:00.000Z'})];
const cases={A:snap([a]),B:snap([b],'en'),C:snap(c,'bilingual'),D:snap([d],'id'),E:snap(e,'en'),F:snap([],'bilingual')};
assert.equal(cases.A.counts.score,70);assert.equal(cases.A.counts.accuracy.toFixed(1),'82.4');assert.equal(cases.A.counts.responded,95);
assert.equal(cases.B.counts.score,50);assert.equal(cases.B.counts.accuracy,100);
assert.equal(cases.C.counts.accuracy.toFixed(1),'53.6');assert.equal(cases.D.counts.firstCorrect,0);assert.equal(cases.D.counts.hintCount,1);assert.equal(cases.D.counts.retryCount,1);
assert.equal(cases.D.competencies[0].mastery.forms,0);assert.equal(cases.E.change_pp,28);assert.equal(cases.F.counts.score,null);
assert.equal(snap([e[0],{...e[1],level:4}]).change_pp,null);assert.equal(cases.A.operations.find(op=>op.operation==='DIV').score,null);
const q={...initial,grade:'3',level:'2',mode:'assessment',classId:'3A',timezone:'Asia/Jakarta',from:'2026-11-05',to:'2026-11-05'};
const replay=[a,{...a,attempt_id:'decoy1',profile_id:'demo-02'},{...a,attempt_id:'decoy2',mode:'practice'},{...a,attempt_id:'decoy3',data_origin:'local_practice'},{...a,attempt_id:'decoy4',started_at:'2026-11-05T17:00:00.000Z'}];
const filtered=filterSessions(replay,subjects,q);
assert.equal(filtered.length,1);assert.deepEqual(snap(replay,'id',who,q).counts,sumCounts(filtered));assert.deepEqual(periodBounds(q),['2026-11-04T17:00:00.000Z','2026-11-05T17:00:00.000Z']);
assert.throws(()=>periodBounds({...q,to:'2026-09-01'}),/RANGE/);
const local=snap([{...a,data_origin:'local_practice'}],'en',who,{...initial,source:'local_practice'});assert.equal(local.core.verification_status,'unverified');assert.match(JSON.stringify(documentModel(local)),/institutionally unverified/);
assert.match(nextStep(cases.F,'en'),/initial evidence/);assert.match(nextStep(cases.D,'en'),/more responses/);
const zeroAndOngoing=snap([{...a,status:'ongoing'}]);assert.equal(zeroAndOngoing.core.assigned_count,0);assert.equal(zeroAndOngoing.ongoing,1);
const reports=[cases.A,{...cases.F,person:subjects[1]}];
for(const [id,s] of Object.entries(cases)) {
  const p=path.join(out,'MET-'+id);await fs.mkdir(p,{recursive:true});
  for(const k of ['pdf','docx','xlsx','csv','json'])await fs.writeFile(path.join(p,'report.'+k),await encode(s,k,{font}));
}
await fs.writeFile(path.join(out,'local.json'),await encode(local,'json'));
const selected=[];const job=await batch(reports,{font,onProgress:(i,n)=>selected.push([i,n])});assert.deepEqual(selected,[[1,2],[2,2]]);
await fs.writeFile(path.join(out,'reports.zip'),job.data);
const ctrl=new AbortController();let steps=0;
await assert.rejects(batch(Array(20).fill(cases.A),{font,signal:ctrl.signal,onProgress:()=>{steps++;ctrl.abort();}}),err=>err.name==='AbortError');assert.equal(steps,1);
const partial=await batch([cases.A,{...cases.A,person:{...who,id:'demo-99',alias:'Unsupported '+String.fromCodePoint(0x10ffff)}}],{font});assert.equal(partial.manifest.files.length,1);assert.equal(partial.manifest.errors.length,1);
const long=snap(Array.from({length:48},(_,i)=>({...a,attempt_id:'long-'+i})), 'bilingual', {...who,alias:'=SUM(1,2) Demo Prévisualisation '+('Nusantara ').repeat(7)},initial,[{at:when,profileId:who.id,type:'note',revision:1,author:'Demo A',text:'Contoh: −12 ÷ 3 = −4, ½ × 2 = 1, 1⁄8, 0,125. '+('Kemajuan individu diperiksa dari dua form sebanding. ').repeat(22)}]);
long.change_pp=-12.3;
for(const k of ['pdf','docx','xlsx','csv','json'])await fs.writeFile(path.join(out,'stress.'+k),await encode(long,k,{font,delimiter:';'}));
const result={status:'PASS',engine:process.version,verified:['MET-A through MET-F exact denominators; all formats generated','filter scope, UTC boundaries, administrative class and material grade','local/demo provenance, wrong-origin exclusion','comparable pair and material-level change','operation and unfinished-data separation','batch sequential progress, cancellation and explicit per-file failure'],fixtures:Object.fromEntries(Object.entries(cases).map(([id,s])=>[id,s.core])),batch_errors_exercised:partial.manifest.errors.length};
await fs.writeFile(path.join(root,'evidence/teacher/engine.json'),JSON.stringify(result,null,2));console.log('Teacher report and batch assertions passed.');
