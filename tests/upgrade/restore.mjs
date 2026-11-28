/* Replay a real v1.0 backup without network access or a copy of its old bank. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {importBackup,previewBackup,readBackup,exportBackup} from '../../src/data/backup.js';
import {listAttempts,scopeForLocal,getAttempt,saveAttempt,listEvents} from '../../src/data/store.js';
import {finish} from '../../src/player/engine.mjs';

const fixture = await readFile(new URL('fixtures/profile-v1.0.0.json', import.meta.url));
const backup = await readBackup(fixture.toString());
const scope=scopeForLocal(backup.profile.id);
const incoming=await previewBackup(backup);
assert.equal(incoming.conflicts.length,0);
assert.equal((await listAttempts(scope)).length,0);
assert.equal(incoming.additions,8); // profile, two snapshots, five original ledger entries
await importBackup(backup);
const repeated=await importBackup(backup);
assert.equal(repeated.additions,0);
assert.equal(repeated.duplicates,8);

const stored=await listAttempts(scope);
for(const {id,data} of backup.records.attempts)assert.deepEqual(await getAttempt(id,scope),data);
const originalEvents=await listEvents(null,scope);
for(const {id,data} of backup.records.events)assert.deepEqual(originalEvents.find(e=>e.event_id===id),data);
const completed=stored.find(a=>a.status==='completed');
assert.deepEqual(completed.items[0].history.map(h=>h.raw_answer),['99','5']);
const ongoing=stored.find(a=>a.status==='ongoing');
assert.equal(ongoing.items[0].draft,'5');
assert.equal(ongoing.content_version,'1.0.0');
const savedQuestions=ongoing.items.map(i=>structuredClone(i.question));
await saveAttempt(ongoing,finish(ongoing),scope);
const finished=await getAttempt(ongoing.attempt_id,scope);
assert.equal(finished.content_version, '1.0.0');
assert.deepEqual(finished.items.map(i=>i.question),savedQuestions);
assert.equal(finished.metrics.C,1);
assert.equal(finished.metrics.U,1);
assert.equal((await listAttempts(scopeForLocal('other-person'))).length,0);
const exported=await exportBackup(scope);
await readBackup(exported);
const report={status:'PASS',environment:'Node '+process.version+'; temporary transactional adapter; native IndexedDB is tested separately.',
  source_archive_sha256:'47594d89f492b440b365a080ba7654f136eef3bcd1537c5d241333c27f9cf3e9',
  source_backup_sha256:createHash('sha256').update(fixture).digest('hex'),original_session_count:2,
  preserved_events:5,old_snapshot_content_version:finished.content_version,old_snapshot_questions_unchanged:2,
  retained_wrong_first_response:'99',retained_revised_answer:'5',restored_draft:'5',
  restored_final:{correct:finished.metrics.C,unseen:finished.metrics.U},duplicate_import_writes:repeated.additions,
  raw_original_attempt_ids:stored.map(a=>a.attempt_id),other_profile_reads:0,final_export_validation:'PASS'};
const target=new URL('../../evidence/ux/upgrade/',import.meta.url);
await mkdir(target,{recursive:true});
await writeFile(new URL('original-backup-roundtrip.json',target),JSON.stringify(report,null,2)+'\n');
console.log('PASS: Original export restored without network; both snapshots, revisions and five events survived the upgrade.');
