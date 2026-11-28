// MATH-001 regression. Every linear text produced from bank ASTs is parsed again by an
// independent reader with ordinary precedence (× ÷ / before + −, left to right) and
// compared with an exact BigInt evaluation of the source AST. Covers questions and all
// solution steps in ID and EN, with and without the decimal preference used for keys.
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tokens,linear,speech,hasDecimals} from '../../src/math/model.mjs';
import {Suite,receiptPath} from '../qa/receipt.mjs';

const ROOT=new URL('../../',import.meta.url).pathname;
const suite=new Suite('MATH-001-linear-roundtrip',{scope:'Full bank text representation versus AST value'});

// ---------- independent exact arithmetic (does not import the app math) ----------
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b];}return a;};
const R=(n,d=1n)=>{if(d===0n)throw Error('DIV0');if(d<0n){n=-n;d=-d;}const g=gcd(n,d)||1n;return [n/g,d/g];};
const add=([a,b],[c,d])=>R(a*d+c*b,b*d),sub=([a,b],[c,d])=>R(a*d-c*b,b*d),mul=([a,b],[c,d])=>R(a*c,b*d),div=([a,b],[c,d])=>R(a*d,b*c);
const same=(x,y)=>x[0]===y[0]&&x[1]===y[1];
function evalAst(a){
  if(a.kind==='binary'){const l=evalAst(a.left),r=evalAst(a.right);return {ADD:add,SUB:sub,MUL:mul,DIV:div}[a.operation](l,r);}
  return R(BigInt(a.numerator),BigInt(a.denominator));
}
// ---------- independent reader for the linear text ----------
function read(text,lang){
  const sep=lang==='id'?',':'.';const src=text.replace(/\s+/g,'');let i=0;
  const peek=()=>src[i];
  function num(){
    let s='';while(i<src.length&&/[0-9]/.test(src[i]))s+=src[i++];
    if(!s)throw Error('NUMBER_EXPECTED at '+i+' in '+text);
    if(src[i]===sep&&/[0-9]/.test(src[i+1]||'')){i++;let f='';while(i<src.length&&/[0-9]/.test(src[i]))f+=src[i++];return R(BigInt(s+f),10n**BigInt(f.length));}
    if(src[i]===(lang==='id'?'.':','))throw Error('WRONG_SEPARATOR in '+text);
    return R(BigInt(s));
  }
  function atom(){
    const c=peek();
    if(c==='−'||c==='-'){i++;const v=atom();return [-v[0],v[1]];}
    if(c==='('){i++;const v=sum();if(src[i++]!==')')throw Error('PAREN in '+text);return v;}
    return num();
  }
  function product(){let v=atom();while('×÷/'.includes(peek()||'@')){const op=src[i++];const r=atom();v=op==='×'?mul(v,r):div(v,r);}return v;}
  function sum(){let v=product();while(peek()==='+'||peek()==='−'||peek()==='-'){const op=src[i++];const r=product();v=op==='+'?add(v,r):sub(v,r);}return v;}
  const v=sum();if(i!==src.length)throw Error('TRAILING in '+text);return v;
}
async function* packs(dir){
  for(const e of await readdir(dir,{withFileTypes:true})){
    const p=join(dir,e.name);
    if(e.isDirectory())yield* packs(p);else if(e.name.endsWith('.mjs'))yield p;
  }
}
const index=JSON.parse(await readFile(join(ROOT,'dist/bank/index.json'),'utf8'));
const counts={packages:0,placements:0,expressions:0,texts:0,grouped_fraction_texts:0};
const failures=[];const affectedIds=new Set();
let sample=null;
for await(const file of packs(join(ROOT,'dist/bank'))){
  const pkg=(await import(pathToFileURL(file).href)).default;counts.packages++;
  for(const q of pkg.questions){
    counts.placements++;
    const asts=[['question',q.expression_ast],...(q.solution_steps||[]).map((s,k)=>['step'+k,s.expression_ast]).filter(x=>x[1])];
    const decimal=hasDecimals(q.expression_ast);
    for(const [where,ast] of asts){
      counts.expressions++;
      const want=evalAst(ast);
      for(const lang of ['id','en'])for(const preferDecimal of decimal?[false,true]:[false]){
        const t=tokens(ast,lang,{preferDecimal}),text=linear(t);counts.texts++;
        if(t.some(x=>x.group)){counts.grouped_fraction_texts++;affectedIds.add(q.question_id);}
        try{const got=read(text,lang);if(!same(got,want))throw Error(`value ${got[0]}/${got[1]} != ${want[0]}/${want[1]}`);}
        catch(e){if(failures.length<40)failures.push({package:pkg.package_id,question_id:q.question_id,where,lang,text,error:e.message});else failures.length++;}
        if(!sample&&pkg.package_id==='MM-G05-L04-DIV-P001'&&where==='question'&&lang==='id'&&text.includes('(3/11)'))sample={package:pkg.package_id,text,speech:speech(t,'id'),key:q.answer};
      }
    }
  }
}
suite.check('bank-complete','4.604 packages and 177.640 placements scanned',()=>{
  if(counts.packages!==index.package_count||counts.placements!==index.question_slots)throw Error(JSON.stringify({counts,index:{p:index.package_count,s:index.question_slots}}));
  return counts;
});
suite.check('roundtrip-all','Every linear text re-reads to the exact AST value',()=>{if(failures.length)throw Error(JSON.stringify(failures.slice(0,10)));return {texts:counts.texts,failures:0};});
suite.check('audit-example-G05-L04-DIV-P001','21 ÷ (3/11) keeps the divisor grouped; key 77',()=>{
  if(!sample)throw Error('sample 21 ÷ (3/11) not found in MM-G05-L04-DIV-P001');
  if(!sample.text.startsWith('21 ÷ (3/11)'))throw Error(sample.text);
  if(sample.key.numerator!=='77'||sample.key.denominator!=='1')throw Error(JSON.stringify(sample.key));return sample;
});
suite.check('grouped-count','Placements whose text needs a grouped fraction are counted (audit baseline 7.632 IDs)',()=>({distinct_question_ids:affectedIds.size,grouped_texts:counts.grouped_fraction_texts}));
// Synthetic structure cases beyond the bank: negatives, nested groups, fractions on both sides, big numbers.
const F=(n,d)=>({kind:'rational',numerator:String(n),denominator:String(d),display:{kind:'fraction',numerator:String(n),denominator:String(d)}});
const I=n=>({kind:'rational',numerator:String(n),denominator:'1',display:{kind:'integer'}});
const D=(n,d,p)=>({kind:'rational',numerator:String(n),denominator:String(d),display:{kind:'decimal',decimal_places:p}});
const B=(operation,left,right)=>({kind:'binary',operation,left,right});
const cases={
  'frac-div-frac':B('DIV',F(3,4),F(5,6)),'frac-mul-frac':B('MUL',F(-3,4),F(5,6)),'neg-frac-divisor':B('DIV',I(21),F(-3,11)),
  'nested-div':B('DIV',I(100),B('DIV',I(10),F(1,2))),'left-div-chain':B('DIV',B('DIV',I(100),F(1,2)),F(5,3)),
  'mixed-ops':B('SUB',B('MUL',F(2,3),I(9)),B('DIV',I(4),F(2,5))),'sub-of-frac':B('SUB',I(1),F(3,4)),
  'decimal-div':B('DIV',D(21,2,1),F(3,11)),'big':B('DIV',I('123456789012345678901234567890'),F('987654321','123456789')),
  'mul-right-frac':B('MUL',I(8),F(3,4)),'deep':B('DIV',I(7),B('MUL',F(1,3),B('DIV',I(2),F(5,7))))
};
for(const [name,ast] of Object.entries(cases))for(const lang of ['id','en'])
  suite.check('synthetic-'+name+'-'+lang,'Linear text value equals AST value',()=>{const text=linear(tokens(ast,lang));const got=read(text,lang),want=evalAst(ast);if(!same(got,want))throw Error(text+' => '+got);return text;});
suite.finish(receiptPath('math-linear-roundtrip.json'),{counts});
