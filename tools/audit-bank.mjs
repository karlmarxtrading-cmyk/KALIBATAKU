/** Recheck the shipped data independently of the generator. Run from the release root. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const schema = read(path.join(root, 'spec/schemas/core.schema.json'));
const defs = new Map();
const allowed = new Set(['type','properties','description','required','additionalProperties','const','enum','pattern','minLength','maxLength','minimum','maximum','items','minItems','maxItems','uniqueItems','oneOf','anyOf','$ref']);
const sha = input => createHash('sha256').update(input).digest('hex');

// The bank uses a closed subset of Draft 2020-12. Reject unimplemented keywords on schema changes.
function compile(s) {
  for (const key of Object.keys(s)) if (!allowed.has(key)) throw new Error('Unsupported schema keyword '+key);
  if (s.$ref) {
    const name = s.$ref.split('/').at(-1);
    if (!defs.has(name)) {
      defs.set(name, null);
      defs.set(name, compile(schema.$defs[name]));
    }
    return v => defs.get(name)(v);
  }
  const options = (s.oneOf || s.anyOf || []).map(compile);
  const fields = Object.fromEntries(Object.entries(s.properties || {}).map(([k, child])=>[k,compile(child)]));
  const pattern = s.pattern ? new RegExp(s.pattern,'u') : null;
  const each = s.items ? compile(s.items) : null;
  return v => {
    if ('const' in s && v !== s.const) return false;
    if (s.enum && !s.enum.includes(v)) return false;
    if (s.oneOf && options.reduce((n,test)=>n+Number(test(v)),0)!==1) return false;
    if (s.anyOf && !options.some(test=>test(v))) return false;
    switch(s.type) {
      case undefined: return true;
      case 'null': return v===null;
      case 'string': {
        if (typeof v!=='string') return false;
        const length = s.maxLength || s.minLength>1 ? Array.from(v).length : v.length;
        return !(length<s.minLength || length>s.maxLength) && (!pattern || pattern.test(v));
      }
      case 'integer': return Number.isInteger(v) && !(v<s.minimum || v>s.maximum);
      case 'array':
        return Array.isArray(v) && !(v.length<s.minItems || v.length>s.maxItems) &&
          (!s.uniqueItems || new Set(v.map(x=>JSON.stringify(x))).size===v.length) && (!each || v.every(each));
      case 'object':
        return v!==null && typeof v==='object' && !Array.isArray(v) &&
          (s.required || []).every(k=>Object.hasOwn(v,k)) &&
          Object.keys(v).every(k=>Object.hasOwn(fields,k) ? fields[k](v[k]) : s.additionalProperties!==false);
      default: throw new Error('Unknown JSON type '+s.type);
    }
  };
}
const validPackage = compile(schema.$defs.Package);
const example = read(path.join(root,'spec/examples/PACKAGE_CONTRACT_EXAMPLE.json'));
assert.ok(validPackage(example));
for (const corrupt of [
  p=>p.questions[0].answer.denominator='0', p=>delete p.questions[0].hint.en, p=>p.questions[0].expression_ast.kind='unknown',
  p=>p.questions[0].strategy_tags.push(p.questions[0].strategy_tags[0]), p=>p.extra=42, p=>p.questions[0].fingerprint='x'
]) {
  const clone=structuredClone(example);corrupt(clone);assert.equal(validPackage(clone),false);
}

function gcd(a,b) { while (b) [a,b]=[b,a%b]; return a<0n?-a:a; }
function frac(n,d=1n) {
  assert.notEqual(d,0n);
  const k=gcd(n,d)*(d<0n?-1n:1n);
  return [n/k,d/k];
}
function math(op,[a,b],[c,d]) {
  switch(op){
    case '+': return frac(a*d+b*c,b*d);
    case '-': return frac(a*d-b*c,b*d);
    case '*': return frac(a*c,b*d);
    case '/': return frac(a*d,b*c);
  }
  throw new Error('Invalid operator '+op);
}
function neutralValue(source) {
  const input=source.replaceAll('−','-').replaceAll('×','*').replaceAll('÷','/').replaceAll('⁄','/').replace(/\s/g,'');
  const tokens=input.match(/\d+(?:\.\d+)?|[+*/()-]/g)||[];
  assert.equal(tokens.join(''),input);
  let i=0;
  function atom(){
    const t=tokens[i++];
    if(t==='-'){const [n,d]=atom();return [-n,d];}
    if(t==='('){const res=sum();assert.equal(tokens[i++],')');return res;}
    assert.match(t||'',/^\d+(?:\.\d+)?$/);
    const [whole,fraction='']=t.split('.');
    return frac(BigInt(whole+fraction),10n**BigInt(fraction.length));
  }
  function product(){let res=atom();while(['*','/'].includes(tokens[i]))res=math(tokens[i++],res,atom());return res;}
  function sum(){let res=product();while(['+','-'].includes(tokens[i]))res=math(tokens[i++],res,product());return res;}
  const res=sum();assert.equal(i,tokens.length);return res;
}
function fingerprint(node){
  if(node.kind==='rational'){
    const n=BigInt(node.numerator),d=BigInt(node.denominator), [rn,rd]=frac(n,d);
    assert.ok(rn===n && rd===d,'unreduced value');
    if (node.display.kind==='fraction'){
      assert.ok(BigInt(node.display.numerator)*d===BigInt(node.display.denominator)*n);
    } else if(node.display.kind==='decimal'){
      assert.equal((10n**BigInt(node.display.decimal_places))%d,0n);
    } else { assert.equal(d,1n); }
    return 'R:'+String(n)+'/'+String(d);
  }
  let a=fingerprint(node.left),b=fingerprint(node.right);
  if(['ADD','MUL'].includes(node.operation) && a>b) [a,b]=[b,a];
  return node.operation+'('+a+','+b+')';
}
assert.equal(sha(fingerprint(example.questions[0].expression_ast)), example.questions[0].fingerprint, 'normative schema fingerprint example');
function publicFile(url){
  assert.ok(/^bank\/[A-Za-z0-9._/-]+$/.test(url) && !url.split('/').includes('..'));
  return path.join(dist,url);
}

const plan=read(path.join(root,'spec/planning/package_plan.json'));
const planned=new Map(plan.packages.map(p=>[p.package_id,p]));
const index=read(path.join(dist,'bank/index.json'));
const ids=new Set(), forms=new Set(), usedFiles=new Set(), unique=new Set();
const errors=[];
let slots=0, active=0, inactive=0, biggest=0, shards=0, within=0;
for(const g of index.grades){
  const grade=read(publicFile(g.url));
  for(const l of grade.levels){
    const level=read(publicFile(l.url));
    shards++;
    for(const c of level.competencies){
      if(c.active) active++;else inactive++;
      for(const meta of c.packages || []){
        const file=publicFile(meta.url),buf=fs.readFileSync(file);
        try {
          assert.equal(sha(buf),meta.sha256,'package checksum');
          const match=/^\s*export\s+default\s+(\{[\s\S]*\})\s*;?\s*$/.exec(buf.toString('utf8'));
          assert.ok(match,'must be a single data-only JSON export');
          const p=JSON.parse(match[1]);
          assert.ok(validPackage(p),'Package failed structural contract');
          assert.equal(p.artifact_status,'validated_content');
          const task=planned.get(p.package_id);
          assert.ok(task && c.active);
          assert.equal(p.grade,g.grade); assert.equal(p.level,l.level); assert.equal(p.target_competency_id,c.competency_id);
          for (const key of ['purpose','operation','grade','level']) assert.equal(p[key],task[key],key);
          assert.equal(p.question_count,p.questions.length); assert.equal(meta.question_count,p.question_count);
          assert.equal(meta.package_id,p.package_id); assert.equal(meta.content_version,p.content_version);
          assert.ok(!ids.has(p.package_id) && !usedFiles.has(meta.url),'duplicate package id or URL');
          ids.add(p.package_id); usedFiles.add(meta.url);
          const local=new Set();
          if(p.purpose==='assessment'){
            assert.ok(p.form_id && p.form_family_id);
            forms.add(p.target_competency_id+':'+p.form_id);
          }
          for (const q of p.questions){
            const f=sha(fingerprint(q.expression_ast));
            assert.equal(f,q.fingerprint,'fingerprint for '+q.question_id);
            const [n,d]=neutralValue(q.neutral_expression);
            assert.ok(String(n)===q.answer.numerator && String(d)===q.answer.denominator,'neutral expression vs key '+q.neutral_expression);
            if(local.has(f))within++;
            local.add(f);unique.add(f);slots++;
          }
          biggest=Math.max(biggest,gzipSync(buf,{level:6}).length);
        } catch(error) { errors.push({package:meta.package_id,message:error.message});if(errors.length<4)console.error(meta.package_id,error.message); }
      }
    }
  }
  console.log('Grade',g.grade,ids.size,'packages;',errors.length,'errors');
}
const physical=fs.readdirSync(path.join(dist,'bank'),{recursive:true}).filter(n=>n.endsWith('.mjs') || n.endsWith('.js'));
for(const [what,actual,expected] of [['physical files',physical.length,ids.size],['package IDs',ids.size,planned.size],['duplicate in a package',within,0],['active',active,281],['inactive',inactive,19],['levels',shards,60],['forms',forms.size,562]]){
  if(actual!==expected)errors.push({check:what,actual,expected});
}
if(biggest>61440)errors.push({check:'maximum compressed package size',actual:biggest,maximum:61440});
const summary={status:errors.length?'FAIL':'PASS',checks:['physical package SHA-256, plan ID, curriculum cell, purpose and grade-level manifest',
 'closed structural keywords from core.schema.json with six rejected corrupt fixtures','independent plain-text precedence and rational arithmetic',
 'display values and canonical SHA-256 same over commutative operands','per-package uniqueness and global inventory'],
 packages:ids.size,slots,unique:unique.size,intentionalRepetitions:slots-unique.size,duplicatesInPackages:within,assessmentForms:forms.size,
 maximumPackageGzipBytes:biggest,errors:errors.slice(0,25),totalErrors:errors.length};
fs.mkdirSync(path.join(root,'evidence/bank'),{recursive:true});
fs.writeFileSync(path.join(root,'evidence/bank/independent-distribution-audit.json'),JSON.stringify(summary,null,2)+'\n');
if(errors.length)process.exitCode=1;
