import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {finish,createAttempt,submit} from '../../src/player/engine.mjs';
import {inputGuide} from '../../src/learning/input-guide.mjs';
import {parseAnswer} from '../../src/player/math.mjs';
import {readBackup,previewBackup,importBackup,exportBackup} from '../../src/data/backup.js';
import {scopeForLocal,getAttempt,saveAttempt,acquireAttempt} from '../../src/data/store.js';
const root=fileURLToPath(new URL('../..',import.meta.url));
const text=await readFile(new URL('./legacy-v100-backup.json',import.meta.url),'utf8');
const archive=await readBackup(text), old=archive.records.attempts[0].data;
assert.equal(old.content_version,'1.0.0');
const scope=scopeForLocal(old.profile_id);
assert.equal((await previewBackup(text)).conflicts.length,0);
await importBackup(text);
const resumed=await getAttempt(old.attempt_id,scope);
assert.deepEqual(resumed.items[0].question,old.items[0].question);
assert.equal(resumed.items[0].draft,'9');
await acquireAttempt(resumed.attempt_id,scope);
await saveAttempt(resumed,submit(resumed,0),scope);
await saveAttempt(resumed,finish(resumed),scope);
assert.equal(resumed.items[0].final_status,'correct');
const reexported=await readBackup(await exportBackup(scope));
assert.equal(reexported.records.events.length,3);
const saved=reexported.records.attempts[0].data;
assert.deepEqual(saved.items[0].question,old.items[0].question);
for(const e of reexported.records.events) assert.equal(e.data.context.content_version,'1.0.0');
const shard=JSON.parse(await readFile(join(root,'dist/bank/g02/l02.json')));
const entry=shard.competencies.flatMap(c=>c.packages).find(p=>p.package_id===old.package_id);
const current=(await import(pathToFileURL(join(root,'dist',entry.url)))).default;
const fresh=createAttempt(current,scope,{mode:'practice',lang:'id',question_count:1});
const priorItem=old.items[0].question, currentItem=fresh.items[0].question;
for(const key of ['question_id','fingerprint','answer','expression_ast']) assert.deepEqual(priorItem[key],currentItem[key]);
assert.equal(currentItem.question_revision,current.content_version);assert.notDeepEqual(priorItem.explanation,currentItem.explanation);
const leaf=kind=>({kind:'rational',numerator:kind==='fraction'?'−1':'1',denominator:kind==='fraction'?'2':'1',display:{kind}});
const cases=[['integer',leaf('integer'),1],['fraction',leaf('fraction'),5],['decimal',leaf('decimal'),6],
  ['mixed',{kind:'binary',operation:'ADD',left:leaf('decimal'),right:leaf('fraction')},7]];
const examples=[];
for(const [type,ast,grade] of cases) for(const locale of ['id','en']){
  const g=inputGuide({expression_ast:ast},grade,locale);
  assert.equal(g.type,type);
  const samples=g.example.match(/[−-]?\d+(?:[.,/]\d+)?/gu);
  assert(samples?.length);
  for(const s of samples) assert.equal(parseAnswer(s,locale).status,'valid',g.example);
  examples.push({type,locale,copy:g.example,accepted:samples});
}
const receipt={status:'PASS',runner:process.version,environment:'Node ephemeral local store; actual v1.0.0 backup imported using current store + engine',
  fixture:'tests/bank/legacy-v100-backup.json',package:old.package_id,question:priorItem.question_id,
  scope_preserved:scope.profileId===resumed.profile_id,old_revision:priorItem.question_revision,new_revision:currentItem.question_revision,
  draft_resumed:old.items[0].draft,legacy_events_after_finish:reexported.records.events.length,old_explanation:priorItem.explanation,new_explanation:currentItem.explanation,
  persisted_complete_legacy_snapshot:true,same_math:true,guide_examples:examples};
await mkdir(join(root,'evidence/ux/bank'),{recursive:true});
await writeFile(join(root,'evidence/ux/bank/snapshot-upgrade.json'),JSON.stringify(receipt,null,2)+'\n');
console.log('Old draft restored and scored from its original snapshot; new session uses the new revision. Eight locale/input combinations accepted.');
console.log('Snapshot upgrade, re-export and input-guide checks passed.');
