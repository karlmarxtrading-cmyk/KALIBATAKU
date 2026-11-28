// Produce an authentic profile backup with the 1.2.0 application and bank 1.1.0.
//   node tests/upgrade/make-v12-fixture.mjs /path/to/unzipped-1.2.0-release out.json
// The fixture holds one completed and one ongoing session of MM-G03-L05-DIV-P001
// (924 ÷ 11 included). It is generated once and committed as test input.
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=pathToFileURL(resolve(process.argv[2])+'/');
const {createAttempt,begin,visit,editDraft,submit,finish}=await import(new URL('src/player/engine.mjs',root));
const {createProfile,scopeForLocal,saveAttempt}=await import(new URL('src/data/store.js',root));
const {exportBackup}=await import(new URL('src/data/backup.js',root));
const pkg=(await import(new URL('dist/bank/v1.1/g03/l05/MM-G03-L05-DIV-P001.mjs',root))).default;
const scope=scopeForLocal((await createProfile('Fixture 1.2.0')).id);
const done=createAttempt(pkg,scope,{mode:'practice',lang:'id',question_count:3});
await saveAttempt(done,begin(done),scope);
for(let i=0;i<3;i++){visit(done,i);const k=done.items[i].question.answer;editDraft(done,i,k.numerator,'id');await saveAttempt(done,submit(done,i),scope);}
await saveAttempt(done,finish(done),scope);
const open=createAttempt(pkg,scope,{mode:'practice',lang:'en',question_count:2});
await saveAttempt(open,begin(open),scope);editDraft(open,0,'8','en');await saveAttempt(open,submit(open,0),scope);
editDraft(open,0,'84','en');await saveAttempt(open,null,scope);
writeFileSync(process.argv[3],JSON.stringify(await exportBackup(scope),null,1));
console.log('fixture',pkg.content_version,done.items.map(i=>i.question.neutral_expression));
