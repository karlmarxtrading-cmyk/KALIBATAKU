// Validated presentation tokens. All destinations share these tokens, including Word.
import {rational,equal,parseAnswer} from '../player/math.mjs';
const symbols={ADD:'+',SUB:'−',MUL:'×',DIV:'÷'};
const precedence={ADD:1,SUB:1,MUL:2,DIV:2};
const words={id:{'+':'tambah','−':'minus','×':'kali','÷':'dibagi','(':'buka kurung',')':'tutup kurung'},en:{'+':'plus','−':'minus','×':'times','÷':'divided by','(':'open parenthesis',')':'close parenthesis'}};
function integer(v,positive=false){if(typeof v!=='string'||!(positive?/^[1-9]\d{0,79}$/:/^-?\d{1,80}$/).test(v))throw Error('INVALID_OPERAND');return BigInt(v);}
function decimal(n,d,places,lang){
  if(!Number.isInteger(places)||places<0||places>80)throw Error('INVALID_DECIMAL_SCALE');
  const scaled=n*10n**BigInt(places);
  if(scaled%d!==0n)throw Error('INEXACT_DECIMAL');
  const digits=(scaled<0n?-scaled/d:scaled/d).toString().padStart(places+1,'0');
  return (scaled<0n?'−':'')+(places?digits.slice(0,-places)+(lang==='id'?',':'.')+digits.slice(-places):digits);
}
function placesFor(d){let two=0,five=0;while(d%2n===0n){two++;d/=2n;}while(d%5n===0n){five++;d/=5n;}return d===1n?Math.max(two,five):null;}
export function hasDecimals(a){return a?.kind==='binary'?(hasDecimals(a.left)||hasDecimals(a.right)):a?.display?.kind==='decimal';}
export function tokens(ast,lang='id',{preferDecimal=false}={}){
 const out=[];let nodes=0;
 function visit(a,parent,side,depth){
  if(depth>24||++nodes>1000||!a||typeof a!=='object')throw Error('INVALID_AST');
  if(a.kind==='binary'){
   if(!Object.hasOwn(symbols,a.operation))throw Error('INVALID_OPERATION');
   // A right-hand operation at equal precedence keeps its authored grouping.
   const paren=parent&&(precedence[a.operation]<precedence[parent]||(side==='right'&&precedence[a.operation]===precedence[parent]));
   if(paren)out.push({type:'sign',text:'('});visit(a.left,a.operation,'left',depth+1);out.push({type:'op',text:symbols[a.operation]});visit(a.right,a.operation,'right',depth+1);if(paren)out.push({type:'sign',text:')'});return;
  }
  if(a.kind!=='rational')throw Error('INVALID_AST');
  let n=integer(a.numerator),d=integer(a.denominator,true);const disp=a.display;
  if(disp&&(!['integer','fraction','decimal'].includes(disp.kind)||typeof disp!=='object'))throw Error('INVALID_DISPLAY');
  if(disp?.kind==='integer'&&n%d!==0n)throw Error('INVALID_INTEGER_DISPLAY');
  if(disp?.kind==='fraction'){const top=integer(disp.numerator),bottom=integer(disp.denominator,true);if(top*d!==n*bottom)throw Error('DISPLAY_VALUE_MISMATCH');n=top;d=bottom;}
  const negative=n<0n, brackets=negative&&parent&&side==='right';
  if(brackets)out.push({type:'sign',text:'('});
  // In one-line text a fraction n/d behaves like a division at multiplicative
  // precedence. It keeps the AST grouping with the same rule used for binary nodes.
  const group=!brackets&&parent&&precedence[parent]===precedence.DIV&&side==='right';
  if(disp?.kind==='decimal'&&!Number.isInteger(disp.decimal_places))throw Error('INVALID_DECIMAL_SCALE');
  const scale=disp?.kind==='decimal'?disp.decimal_places:preferDecimal&&!disp&&d!==1n?placesFor(d):null;
  if(scale!=null)out.push({type:'number',text:decimal(n,d,scale,lang)});
  else if(disp?.kind==='fraction'||n%d!==0n)out.push(group?{type:'fraction',n:String(n).replace('-','−'),d:String(d),group:true}:{type:'fraction',n:String(n).replace('-','−'),d:String(d)});
  else out.push({type:'number',text:String(n/d).replace('-','−')});
  if(brackets)out.push({type:'sign',text:')'});
 }
 visit(ast,null,null,0);return out;
}
export const asRational=v=>({kind:'rational',numerator:v.numerator,denominator:v.denominator});
export function enteredAst(history){
 if(!history?.answer)return null;
 const ast=asRational(history.answer),raw=history.raw_answer?.trim().replaceAll('−','-').replaceAll('⁄','/');
 const parsed=parseAnswer(raw,history.draft_locale||'id');if(parsed.status!=='valid'||!equal(parsed.value,ast))return ast;
 if(raw.includes('/')){const [n,d]=raw.split('/').map(v=>String(BigInt(v.trim())));ast.display={kind:'fraction',numerator:n,denominator:d};}
 else if(/[.,]/.test(raw))ast.display={kind:'decimal',decimal_places:raw.split(/[.,]/)[1].length};
 return ast;
}
// Linear text is used for fallback, copy, CSV/XLSX and print. Grouped fractions
// keep their parentheses so that the text has the same value as the AST.
export const linear=t=>t.map(x=>x.type==='fraction'?(x.group?'('+x.n+'/'+x.d+')':x.n+'/'+x.d):x.type==='op'?' '+x.text+' ':x.text).join('');
export function linearText(ast,lang='id',opts={}){return linear(tokens(ast,lang,opts));}
export function speech(t,lang){return t.map(x=>{if(x.type!=='fraction')return words[lang]?.[x.text]||x.text;const f=x.n+(lang==='id'?' per ':' over ')+x.d;return x.group?words[lang]['(']+' '+f+' '+words[lang][')']:f;}).join(' ').replaceAll('−',lang==='id'?'minus ':'negative ').replace(/(\d)[.,](?=\d)/g,lang==='id'?'$1 koma ':'$1 point ');}
export function mathML(t){return '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>'+t.map(x=>x.type==='fraction'?'<mfrac><mn>'+x.n+'</mn><mn>'+x.d+'</mn></mfrac>':x.type==='number'?'<mn>'+x.text+'</mn>':'<mo>'+x.text+'</mo>').join('')+'</mrow></math>';}
export function decimalPreference(q){return {preferDecimal:hasDecimals(q?.expression_ast)};}
