// Upgrade from application 1.2.0 / bank 1.1.0 to this release (bank 1.2.0).
// Old sessions keep their stored item snapshots (lineage), resume and finish; new
// sessions of the same package use the revised 1.2.0 wording with identical maths.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Suite,receiptPath} from '../qa/receipt.mjs';
import {createAttempt,begin,submit,finish,editDraft,visit} from '../../src/player/engine.mjs';
import {readAny,previewBackup,importBackup,exportArchive,readArchive} from '../../src/data/backup.js';
import {scopeForLocal,getAttempt,listAttempts,saveAttempt,acquireAttempt,listEvents} from '../../src/data/store.js';

const ROOT=new URL('../../',import.meta.url);
const s=new Suite('UPGRADE-app1.2.0-bank1.1.0',{scope:'Restore and resume sessions recorded with bank 1.1.0 on the 1.3.0 application'});
const text=await readFile(new URL('fixtures/profile-app1.2.0-bank1.1.0.json',import.meta.url),'utf8');
const blob=new Blob([text],{type:'application/json'});
const backup=await readAny(blob);const scope=scopeForLocal(backup.profile.id);
await s.checkAsync('preview-old-backup','Format-1 backup written by 1.2.0 previews without conflicts',async()=>{const p=await previewBackup(blob);if(p.conflicts.length||!p.additions)throw Error(JSON.stringify(p));return {additions:p.additions,sessions:p.sessions};});
await s.checkAsync('import-old-backup','Import restores both sessions with their 1.1.0 snapshots',async()=>{
  await importBackup(blob);const list=await listAttempts(scope);
  if(list.length!==2||!list.every(a=>a.content_version==='1.1.0'))throw Error(JSON.stringify(list.map(a=>[a.status,a.content_version])));
  return list.map(a=>[a.status,a.content_version]);
});
const ongoing=(await listAttempts(scope)).find(a=>a.status==='ongoing');
const oldItem=structuredClone(ongoing.items[1].question);
await s.checkAsync('resume-finish-old','Ongoing 1.1.0 session resumes, keeps its snapshot and finishes',async()=>{
  await acquireAttempt(ongoing.attempt_id,scope);
  visit(ongoing,1);editDraft(ongoing,1,'84','en');await saveAttempt(ongoing,submit(ongoing,1),scope);
  await saveAttempt(ongoing,finish(ongoing),scope);
  const after=await getAttempt(ongoing.attempt_id,scope);
  if(after.status!=='completed'||after.content_version!=='1.1.0')throw Error(after.status+' '+after.content_version);
  if(JSON.stringify(after.items[1].question)!==JSON.stringify(oldItem))throw Error('snapshot changed');
  return {status:after.status,first:after.items[0].first_correct,final:after.items[0].final_correct,history:after.items[0].history.map(h=>h.raw_answer)};
});
await s.checkAsync('old-snapshot-wording','Old review shows the wording the learner saw (1.1.0 snapshot), not rewritten text',async()=>{
  if(!oldItem.explanation.id.includes('−88'))throw Error(oldItem.explanation.id);return oldItem.explanation.id;
});
const shard=JSON.parse(await readFile(new URL('dist/bank/g03/l05.json',ROOT),'utf8'));
const entry=shard.competencies.flatMap(c=>c.packages).find(p=>p.package_id==='MM-G03-L05-DIV-P001');
const current=(await import(new URL('dist/'+entry.url,ROOT).href)).default;
await s.checkAsync('new-session-new-wording','A new session of the same package uses bank 1.2.0 wording with the same question identity and key',async()=>{
  const q=current.questions.find(x=>x.question_id===oldItem.question_id);
  for(const k of ['question_id','fingerprint','answer','expression_ast'])if(JSON.stringify(q[k])!==JSON.stringify(oldItem[k]))throw Error(k);
  if(current.content_version!=='1.2.0'||q.question_revision!=='1.2.0'||q.explanation.id.includes('−'))throw Error(JSON.stringify(q.explanation));
  const a=createAttempt(current,scope,{mode:'practice',lang:'id',question_count:2});await saveAttempt(a,begin(a),scope);
  return {content_version:a.content_version,explanation:q.explanation.id,url:entry.url};
});
await s.checkAsync('reexport-archive','The upgraded profile exports as an archive and re-reads with every event',async()=>{
  const b=await readArchive(await exportArchive(scope));const events=await listEvents(null,scope);
  if(b.records.events.length!==events.length)throw Error(b.records.events.length+' vs '+events.length);
  return {attempts:b.records.attempts.length,events:events.length,versions:[...new Set(b.records.attempts.map(r=>r.data.content_version))].sort()};
});
s.finish(receiptPath('upgrade-bank-1.2.json'));
