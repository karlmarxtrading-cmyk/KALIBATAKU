// Real ZIP recovery whose unpacked row values exceed V8's single-string bound.
// Repeated references in each synthetic source row keep fixture seeding small.
// Every independently encoded archive part is about 8 MB.
import assert from 'node:assert/strict';
import {constants} from 'node:buffer';
import {readFile} from 'node:fs/promises';
import {exportBackup,exportRecoveryBackup,previewBackup,importBackup} from '../../src/data/backup.js';
import {readZipIndex,readEntry} from '../../src/data/archive.js';
import {createProfile,scopeForLocal,scopeKey,saveAttempt,deleteProfile,profileImpact,getAttempt} from '../../src/data/store.js';
import {transaction,row,key} from '../../src/data/db.js';
import {createAttempt,begin,editDraft} from '../../src/player/engine.mjs';

const scope=scopeForLocal((await createProfile('Capacity beyond string limit')).id);
const pkg=JSON.parse(await readFile(new URL('../../spec/examples/PACKAGE_CONTRACT_EXAMPLE.json',import.meta.url)));
const attempt=createAttempt(pkg,scope,{mode:'practice',seed:81,question_count:1});
await saveAttempt(attempt,begin(attempt),scope);
editDraft(attempt,0,'4/','id');
const count=68,repeats=100,chars=80000,unit={text:'w'.repeat(chars)};
await transaction(['records'],true,async tx=>{
  for(let i=0;i<count;i++){
    const id='r'+i;
    await tx.put('records',row(scopeKey(scope),'capacity|'+id,{type:'capacity',id,value:Array(repeats).fill(unit)}));
  }
});
assert(chars*repeats*count>constants.MAX_STRING_LENGTH);
await assert.rejects(()=>exportBackup(scope),{code:'BACKUP_TOO_LARGE'});
// This production function also reads and validates the ZIP before returning.
const blob=await exportRecoveryBackup(scope,attempt);
assert.equal(blob.type,'application/zip');
const entries=await readZipIndex(blob,{allowed:()=>true});
const m=JSON.parse(new TextDecoder().decode(await readEntry(blob,entries.get('manifest.json'),{limit:4<<20})));
assert.deepEqual(m.totals,{attempts:1,events:1,records:count,parts:m.parts.length});
assert.equal(m.recovery_draft.text,'4/');assert.equal(m.recovery_draft.attempt_id,attempt.attempt_id);
const unpacked=m.parts.reduce((sum,p)=>sum+p.bytes,0);
assert(unpacked>constants.MAX_STRING_LENGTH&&m.parts.every(p=>p.bytes<=32*1024**2));
await deleteProfile(scope.profileId);
const preview=await previewBackup(blob);
assert.equal(preview.additions,count+3);assert.equal(preview.recovery_draft,true);
assert.deepEqual(await profileImpact(scope.profileId),{sessions:0,events:0,records:0});
const committed=await importBackup(blob);
assert.equal(committed.additions,preview.additions);assert.equal(committed.conflicts.length,0);
assert.deepEqual(await profileImpact(scope.profileId),{sessions:1,events:1,records:count});
const restored=await getAttempt(attempt.attempt_id,scope);assert.equal(restored.items[0].draft,'4/');assert(restored.items[0].dirty);
const ns=scopeKey(scope);
await transaction(['records'],false,async tx=>{
  for(let i=0;i<count;i++){
    const restored=(await tx.get('records',key(ns,'capacity|r'+i))).data.value;
    assert.equal(restored.length,repeats);assert(restored.every(v=>v.text===unit.text));
  }
});
const manifest=JSON.parse(await readFile(new URL('../../dist/offline-assets.json',import.meta.url)));
console.log(JSON.stringify({status:'PASS',command:'node tests/v15/backup-capacity-large-zip.mjs',
  runtime:process.version,time:new Date().toISOString(),offline_release:manifest.release,source:'Node memory adapter',
  logical_value_bytes:count*repeats*chars,unpacked_part_bytes:unpacked,engine_max_string_length:constants.MAX_STRING_LENGTH,
  rows:count+2,counts:m.totals,largest_part_bytes:Math.max(...m.parts.map(p=>p.bytes)),zip_bytes:blob.size,
  json_writer:'BACKUP_TOO_LARGE',recovery_export_and_readback:'PASS',preview_additions:preview.additions,restored_additions:committed.additions,restored_values_verified:count*repeats,draft:m.recovery_draft.text},null,2));
