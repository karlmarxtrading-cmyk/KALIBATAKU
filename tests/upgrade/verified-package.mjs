import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readVerifiedPackage} from '../../src/core/package-data.mjs';

const root = new URL('../../dist/',import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path,root)));
const index = await json('bank/index.json');
const grade = await json(index.grades[0].url);
const level = await json(grade.levels[0].url);
const entry = level.competencies.find(c=>c.active).packages[0];
const bytes = await readFile(new URL(entry.url,root));
const sha = data => createHash('sha256').update(data).digest('hex');
globalThis.document = {baseURI:root.href};
let count=0, next=()=>new Response(bytes);
globalThis.fetch=async()=>{count++;return next();};

next=()=>new Response(null,{status:503});
await assert.rejects(readVerifiedPackage(entry),/BANK_LOAD/);
next=()=>new Response(bytes.subarray(0,-1));
await assert.rejects(readVerifiedPackage(entry),/CHECKSUM_MISMATCH/);
const changed=Buffer.from(bytes);
changed[changed.length-3]^=1;
next=()=>new Response(changed);
await assert.rejects(readVerifiedPackage(entry),/CHECKSUM_MISMATCH/);
const broken=Buffer.from('export default null;\n');
next=()=>new Response(broken);
await assert.rejects(readVerifiedPackage({...entry,sha256:sha(broken),bytes:broken.length}));
next=()=>new Response(bytes);
const pack=await readVerifiedPackage(entry);
assert.equal(pack.package_id,entry.package_id);
assert.equal(pack.questions.length,entry.question_count);
const before=count;
assert.equal(await readVerifiedPackage(entry),pack);
assert.equal(count,before);
const deadline=new AbortController();deadline.abort();
await assert.rejects(readVerifiedPackage(entry,deadline.signal),{name:'AbortError'});
const out = new URL('../../evidence/ux/deploy/',import.meta.url);
await mkdir(out,{recursive:true});
await writeFile(new URL('package-verification.json',out),JSON.stringify({
  status:'PASS',environment:'Node '+process.version+'; response fixture + physical bank bytes',
  input:{package_id:entry.package_id,content_version:entry.content_version,sha256:sha(bytes),bytes:bytes.length},
  checks:['503 rejected','truncated response rejected','equal-length modified response rejected','invalid package body rejected','original accepted','second read used verified bytes','aborted plan rejected']
},null,2)+'\n');
console.log('PASS package integrity and abort checks:',entry.package_id);
