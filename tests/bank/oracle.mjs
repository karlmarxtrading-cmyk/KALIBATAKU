// Independent exact oracle: no production solver, generator, or application code imported.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const [root, grade, level] = process.argv.slice(2);
const digest = value => createHash('sha256').update(value).digest('hex');
const abs = x => x < 0n ? -x : x;
function gcd(a,b) {
  a=abs(a); b=abs(b);
  while(b){const remainder=a%b; a=b; b=remainder;}
  return a;
}
function reduce(n,d) {
  assert(d!==0n,'zero divisor');
  const k=gcd(n,d)*(d<0n?-1n:1n);
  return [n/k,d/k];
}
function rational(node) {
  const n=BigInt(node.numerator),d=BigInt(node.denominator);
  assert.deepEqual(reduce(n,d),[n,d],'canonical leaf');
  return [n,d];
}
function solve(node, state) {
  let pair, canonical;
  if(node.kind==='rational') {
    pair=rational(node);
    const [n,d]=pair;
    if(node.display) {
      const f=node.display;
      if(f.kind==='integer') assert.equal(d,1n);
      else if(f.kind==='fraction') {
        assert(BigInt(f.denominator)>0n);
        assert.deepEqual(reduce(BigInt(f.numerator),BigInt(f.denominator)),pair);
      } else {
        assert.equal(f.kind,'decimal');
        assert(Number.isInteger(f.decimal_places) && f.decimal_places>=0 && f.decimal_places<=8);
        assert.equal((n*10n**BigInt(f.decimal_places))%d,0n);
      }
    } else if(state?.requireDisplay) throw Error('missing leaf display');
    canonical='R:'+n.toString()+'/'+d.toString();
  } else {
    assert.equal(node.kind,'binary');
    const {pair:[a,b],canonical:left}=solve(node.left,state);
    const {pair:[c,d],canonical:right}=solve(node.right,state);
    const op=node.operation;
    const numer=op==='ADD'?a*d+b*c:op==='SUB'?a*d-b*c:op==='MUL'?a*c:op==='DIV'?a*d:null;
    assert.notEqual(numer,null);
    pair=reduce(numer,op==='DIV'?b*c:b*d);
    const sort=(op==='ADD'||op==='MUL')&&left>right;
    canonical=op+'('+(sort?right:left)+','+(sort?left:right)+')';
    if(state){state.ops.add(op);state.operatorCount++;}
  }
  if(state){
    if(state.grade<=6)assert(pair[0]>=0n,'negative early intermediate');
    if(state.grade<=4)assert.equal(pair[1],1n,'fractional early intermediate');
  }
  return {pair,canonical};
}
const dist=join(root,'dist');
const shard=JSON.parse(await readFile(join(dist,'bank',grade,level+'.json')));
let slots=0, packages=0, steps=0, bilingual=0, maxSteps=0;
const shapeCounts={};
for (const cell of shard.competencies) {
  assert.equal(cell.active,cell.packages.length>0);
  for (const meta of cell.packages) {
    const path=join(dist,meta.url);
    const raw=await readFile(path,'utf8');
    assert.equal(digest(raw),meta.sha256);
    assert(raw.startsWith('export default ')&&raw.endsWith(';\n'));
    // The full module has exactly one literal JSON value. Reject any code after or inside it.
    const literal=JSON.parse(raw.slice('export default '.length,-2));
    const pack=(await import(pathToFileURL(path).href)).default;
    assert.deepEqual(pack,literal);
    assert.equal(pack.package_id,meta.package_id);
    assert.equal(pack.question_count,pack.questions.length);
    assert.equal(pack.question_count,meta.question_count);
    assert.equal(pack.target_competency_id,cell.competency_id);
    const fps=new Set();
    for(const q of pack.questions){
      const state={grade:shard.grade,ops:new Set(),operatorCount:0,requireDisplay:true};
      const {pair,canonical}=solve(q.expression_ast,state);
      assert.deepEqual(pair,rational(q.answer),q.question_id);
      assert.equal(digest(canonical),q.fingerprint,'fingerprint');
      assert(!fps.has(q.fingerprint),'within-package canonical duplicate');
      fps.add(q.fingerprint);
      assert.equal(q.competency_id,cell.competency_id);
      if(cell.operation==='MIX') assert(state.ops.size>=2);
      else assert.deepEqual([...state.ops],[cell.operation]);
      shapeCounts[state.operatorCount]=(shapeCounts[state.operatorCount]??0)+1;
      for(const label of [q.hint,q.explanation,pack.title,pack.instructions]){
        assert(label.id.trim()&&label.en.trim());bilingual++;
      }
      maxSteps=Math.max(maxSteps,q.solution_steps.length);
      assert(q.solution_steps.length);
      for(const s of q.solution_steps){
        assert.equal(s.kind,'equivalent_expression');
        assert.deepEqual(solve(s.expression_ast).pair,pair,'non-equivalent full step');
        assert(s.text.id.trim()&&s.text.en.trim()); steps++;
      }
      slots++;
    }
    packages++;
  }
}
console.log(JSON.stringify({grade,level,packages,slots,steps,bilingual,maxSteps,shapeCounts}));
