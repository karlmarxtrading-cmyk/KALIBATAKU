// Run against the untouched 1.4.0 source tree. This records observed transfer
// behavior in a disposable Node profile and deliberately does not expect fixes.
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=pathToFileURL(resolve(process.argv[2])+'/');
const mod=file=>import(new URL(file,root));
const {createProfile,scopeForLocal,saveAttempt}=await mod('src/data/store.js');
const {transaction,row}=await mod('src/data/db.js');
const {scopeKey}=await mod('src/data/common.js');
const {createAttempt,begin,editDraft}=await mod('src/player/engine.mjs');
const {exportBackup,readBackup,exportRecoveryBackup,exportArchive,readArchive}=await mod('src/data/backup.js');
const scope=scopeForLocal((await createProfile('Audit capacity')).id);
const ns=scopeKey(scope);
await transaction(['records'],true,async tx=>{
  for(let i=0;i<100001;i++)await tx.put('records',row(ns,'audit|r'+i,{type:'audit',id:'r'+i,value:{n:i}}));
});
const data=await exportBackup(scope);
await assert.rejects(()=>readBackup(data),{code:'BACKUP_TOO_LARGE'});
const zip=await exportArchive(scope);
const parsed=await readArchive(zip);
assert.equal(parsed.records.records.length,100001);
const pkg=JSON.parse(await readFile(new URL('spec/examples/PACKAGE_CONTRACT_EXAMPLE.json',root)));
const a=createAttempt(pkg,scope,{mode:'practice',seed:78});
await saveAttempt(a,null,scope);await saveAttempt(a,begin(a),scope);editDraft(a,0,'2/','id');
await assert.rejects(()=>exportRecoveryBackup(scope,a),{code:'BACKUP_TOO_LARGE'});
console.log(JSON.stringify({time:new Date().toISOString(),runtime:process.version,rows:100001,json_written:true,bytes:Buffer.byteLength(JSON.stringify(data)),json_reader:'BACKUP_TOO_LARGE',zip_read_rows:parsed.records.records.length,recovery_ongoing_rows:100003,recovery_draft_failure:'BACKUP_TOO_LARGE'},null,2));
