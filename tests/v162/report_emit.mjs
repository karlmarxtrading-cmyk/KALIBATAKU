// Actual release encoders and event store, isolated to ephemeral synthetic profiles.
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createAttempt, begin, editDraft, submit, finish} from '../../dist/player/engine.mjs';
import {createProfile, scopeForLocal, saveAttempt, listAttempts, listEvents} from '../../dist/data/store.js';
import {buildSnapshot, initialFilters} from '../../dist/teacher/report.js';
import {encode} from '../../dist/teacher/export/index.js';

const out = resolve(process.argv[2]);
const read = name => readFile(new URL('../../dist/' + name, import.meta.url));
const font = [await read('teacher/font/DejaVuSans.ttf'), JSON.parse(await read('teacher/font/metrics.json'))];
const templates = [
  ['fraction', '05', '03', 'ADD', 0, '21/12'],
  ['grouped', '11', '03', 'MIX', 1, '14/3'],
];
for (const [name, grade, level, operator, index, revision] of templates) {
  const id = 'MM-G' + grade + '-L' + level + '-' + operator + '-P001';
  const pack = (await import('../../dist/bank/v1.2/g' + grade + '/l' + level + '/' + id + '.mjs')).default;
  const person = await createProfile('QA ' + name);
  const scope = scopeForLocal(person.id);
  const question = pack.questions[index];
  // One complete attempt lies just before local midnight, another just after.
  // Both persist on the same profile and are presented to the report engine.
  for (const stamp of ['2026-11-28T16:59:50Z', '2026-11-28T17:00:01Z']) {
    let t = Date.parse(stamp);
    const attempt = createAttempt(pack, scope, {mode:'practice', items:[{question}], seed:grade, now:t});
    await saveAttempt(attempt, begin(attempt, ++t), scope);
    for (const input of ['99', revision]) {
      editDraft(attempt, 0, input, 'id');
      await saveAttempt(attempt, submit(attempt, 0, ++t), scope);
    }
    await saveAttempt(attempt, finish(attempt, {now:++t}), scope);
  }
  const sessions = await listAttempts(scope);
  const bundles = [];
  for (const session of sessions) {
    bundles.push({started:session.started_at, completed:session.completed_at, id:session.attempt_id,
      question_id:session.items[0].question.question_id, events:await listEvents(session.attempt_id, scope)});
  }
  const who = {id:person.id, alias:person.name, classId:''};
  const filters = {...initialFilters(), source:'local_practice', from:'2026-11-29', to:'2026-11-29', timezone:'Asia/Jakarta'};
  const snapshot = buildSnapshot({person:who, people:[who], attempts:sessions, filters, createdAt:'2026-11-30T00:00:00.000Z', locale:'id'});
  const path = resolve(out, name);
  await mkdir(path, {recursive:true});
  await writeFile(resolve(path, 'ledger.json'), JSON.stringify(bundles, null, 2));
  for (const format of ['json','csv','xlsx','docx','pdf']) {
    await writeFile(resolve(path, 'report.' + format), await encode(snapshot, format, {font}));
  }
}
