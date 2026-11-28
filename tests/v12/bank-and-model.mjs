import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {tokens,linear,mathML,decimalPreference,speech} from '../../src/math/model.mjs';
import {solve,equal} from '../../src/player/math.mjs';
const root=new URL('../../',import.meta.url);
const read=f=>readFile(new URL(f,root));
const fixtures=JSON.parse(await read('evidence/v12/input/math_typography_fixtures.json')).fixtures;
const samples=[];
for(const f of fixtures){assert(equal(solve(f.expression_ast),f.expected_exact_value));const byLang={};
 for(const lang of ['id','en']){const t=tokens(f.expression_ast,lang);byLang[lang]={text:linear(t),speech:speech(t,lang),mathml:mathML(t)};}
 samples.push({id:f.fixture_id,...byLang,exact:f.expected_exact_value});}
assert(samples[1].en.text.includes('10/12'));assert(samples[2].id.text.includes('20,0'));
for(const a of [{kind:'script'},{kind:'rational',numerator:'<b>',denominator:'1'},{kind:'rational',numerator:'2',denominator:'0'},
 {kind:'binary',operation:'href',left:{},right:{}},{kind:'rational',numerator:'1',denominator:'1',display:{kind:'fraction',numerator:'2',denominator:'2"onclick'}}])assert.throws(()=>tokens(a));
let placements=0,steps=0,packages=0,errors=[],seen=new Set();
const manifest=JSON.parse(await read('dist/bank/index.json'));
for(const g of manifest.grades){for(const l of JSON.parse(await read('dist/'+g.url)).levels){for(const c of JSON.parse(await read('dist/'+l.url)).competencies){
 for(const pack of c.packages||[]){
  const bytes=await read('dist/'+pack.url);assert.equal(createHash('sha256').update(bytes).digest('hex'),pack.sha256);
  const pkg=JSON.parse(bytes.toString().replace(/^export default\s*/,'').replace(/;\s*$/,''));packages++;
  for(const q of pkg.questions){placements++;seen.add(q.fingerprint);try{
    assert(equal(solve(q.expression_ast),q.answer));
    for(const lang of ['id','en']){const t=tokens(q.expression_ast,lang);assert(t.length&&speech(t,lang).length&&mathML(t).startsWith('<math'));}
    for(const s of q.solution_steps){steps++;assert(equal(solve(s.expression_ast),q.answer));tokens(s.expression_ast,'id',decimalPreference(q));tokens(s.expression_ast,'en',decimalPreference(q));}
   }catch(e){if(errors.length<50)errors.push({id:q.question_id,error:e.message});}
  }
 }
}}}
const result={packages,placements,unique:seen.size,steps,errors,fixtures:samples,utc:new Date().toISOString(),node:process.version,status:errors.length?'FAIL':'PASS'};
await writeFile(new URL('evidence/v12/bank-model.json',root),JSON.stringify(result,null,2));
console.log({packages,placements,unique:seen.size,steps,errors});assert.equal(errors.length,0);assert.equal(placements,177640);assert.equal(packages,4604);assert.equal(seen.size,168142);
