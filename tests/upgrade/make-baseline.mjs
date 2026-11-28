/* Recreate a synthetic v1.0.0 export using a pristine checkout of that release. */
import {writeFile, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

if (!process.argv[2]) throw Error('Pass the extracted baseline project directory');
const original = pathToFileURL(resolve(process.argv[2]) + '/');
const from = path => new URL(path, original);
assert.equal(JSON.parse(await readFile(from('package.json'))).version, '1.0.0');
const engine = await import(from('src/player/engine.mjs'));
const store = await import(from('src/data/store.js'));
const {exportBackup} = await import(from('src/data/backup.js'));
const {default: pack} = await import(from('dist/bank/v1/g01/l01/MM-G01-L01-ADD-P001.mjs'));
const profile = await store.createProfile('Fixture migrasi 1.0');
const scope = store.scopeForLocal(profile.id);
const make = () => engine.createAttempt(pack, scope, {mode:'practice', question_count:2, lang:'id'});
const done = make();
await store.saveAttempt(done, engine.begin(done), scope);
engine.editDraft(done, 0, '99');
await store.saveAttempt(done, engine.submit(done, 0), scope);
engine.editDraft(done, 0, done.items[0].question.answer.numerator);
await store.saveAttempt(done, engine.submit(done, 0), scope);
await store.saveAttempt(done, engine.finish(done), scope);

const work = make();
await store.saveAttempt(work, engine.begin(work), scope);
engine.editDraft(work, 0, '5');
await store.saveAttempt(work, null, scope);
const backup = await exportBackup(scope);
const ids = (await store.listEvents(null, scope)).map(event => event.event_id);
assert.equal(ids.length, 5);
await writeFile(new URL('fixtures/profile-v1.0.0.json',import.meta.url), JSON.stringify(backup,null,2)+'\n');
console.log('Original release exported', backup.records.attempts.length, 'attempts and', ids.length, 'events.');
