// MATH-001 export regression: the report for MM-G05-L04-DIV-P001 question 1 keeps
// 21 ÷ (3/11) with key 77 in every text destination (CSV, XLSX Math and Family sheets,
// JSON and the document model), and the stacked fraction in DOCX (OMML).
import {readFile} from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';
import {Suite,receiptPath} from '../qa/receipt.mjs';
import {createAttempt,begin,editDraft,submit,finish} from '../../src/player/engine.mjs';
import {createProfile,scopeForLocal,saveAttempt} from '../../src/data/store.js';
import {buildSnapshot,initialFilters} from '../../src/teacher/report.js';
import {documentModel} from '../../src/teacher/document.js';
import {encode} from '../../src/teacher/export/index.js';

const ROOT=new URL('../../',import.meta.url);
const s=new Suite('MATH-001-exports',{scope:'Text exports keep grouped fraction operands'});
const shard=JSON.parse(await readFile(new URL('dist/bank/g05/l04.json',ROOT),'utf8'));
const info=shard.competencies.flatMap(c=>c.packages).find(p=>p.package_id==='MM-G05-L04-DIV-P001');
const pkg=(await import(new URL('dist/'+info.url,ROOT).href)).default;
const scope=scopeForLocal((await createProfile('Fixture pembagian')).id);
const person={id:scope.profileId,alias:'Fixture pembagian',classId:''};
const font=[await readFile(new URL('src/teacher/font/DejaVuSans.ttf',ROOT)),JSON.parse(await readFile(new URL('src/teacher/font/metrics.json',ROOT),'utf8'))];
// Unzip (stored or deflated) without dependencies.
function unzip(buf){
  const b=Buffer.from(buf),out={};let p=0;
  while(b.readUInt32LE(p)===0x04034b50){
    const method=b.readUInt16LE(p+8),cs=b.readUInt32LE(p+18),nl=b.readUInt16LE(p+26),xl=b.readUInt16LE(p+28);
    const name=b.toString('utf8',p+30,p+30+nl),data=b.subarray(p+30+nl+xl,p+30+nl+xl+cs);
    out[name]=(method===8?inflateRawSync(data):data).toString('utf8');p+=30+nl+xl+cs;
  }
  return out;
}
for(const lang of ['id','en']){
  const a=createAttempt(pkg,scope,{mode:'practice',lang,question_count:1});
  await saveAttempt(a,begin(a),scope);
  const q=a.items[0].question;
  s.check('fixture-'+lang,'First question of MM-G05-L04-DIV-P001 is 21 ÷ (3⁄11) with key 77',()=>{if(q.neutral_expression!=='21 ÷ (3⁄11)'||q.answer.numerator!=='77')throw Error(q.neutral_expression+' '+JSON.stringify(q.answer));return q.neutral_expression;});
  editDraft(a,0,'7',lang);await saveAttempt(a,submit(a,0),scope);await saveAttempt(a,finish(a),scope);
  const snap=buildSnapshot({person,people:[person],attempts:[a],filters:{...initialFilters(),source:'local_practice'},notes:[],locale:lang,plan:'',reviewDate:'2026-12-01'});
  const blocks=documentModel(snap).blocks.filter(b=>b.kind==='math').map(b=>b.text);
  s.check('document-model-'+lang,'Document model text keeps the divisor grouped',()=>{if(!blocks.some(t=>t.endsWith('21 ÷ (3/11)')))throw Error(JSON.stringify(blocks));return blocks;});
  const csv=new TextDecoder().decode(await encode(snap,'csv',{font}));
  s.check('csv-'+lang,'CSV contains 21 ÷ (3/11) and key 77',()=>{if(!csv.includes('21 ÷ (3/11)')||!/(^|[,;"])77([,;"]|$)/m.test(csv))throw Error(csv.slice(0,600));return csv.split('\n').filter(l=>l.includes('3/11')).slice(0,2);});
  const xlsx=unzip(await encode(snap,'xlsx',{font}));
  const book=xlsx['xl/workbook.xml'],sheets=[...book.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map(m=>m[1]);
  const rels=xlsx['xl/_rels/workbook.xml.rels'];
  const sheetText=name=>{const rid=[...book.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].find(m=>m[1]===name)[2];const target=rels.match(new RegExp('Id="'+rid+'"[^>]*Target="([^"]+)"'))?.[1]||rels.match(new RegExp('Target="([^"]+)"[^>]*Id="'+rid+'"'))[1];const xml=xlsx['xl/'+target.replace(/^\/?xl\//,'')];
    const shared=[...(xlsx['xl/sharedStrings.xml']||'').matchAll(/<si>(.*?)<\/si>/gs)].map(m=>m[1].replace(/<[^>]+>/g,''));
    return xml.replace(/<c [^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g,(_,i)=>shared[i]).replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&');};
  s.check('xlsx-math-'+lang,'XLSX Math sheet keeps 21 ÷ (3/11) beside key numerator 77',()=>{const t=sheetText('Math');if(!t.includes('21 ÷ (3/11)')||!/\b77\b/.test(t))throw Error(t.slice(0,500));return {sheets};});
  s.check('xlsx-family-'+lang,'XLSX Family sheet keeps 21 ÷ (3/11)',()=>{const t=sheetText('Family');if(!t.includes('21 ÷ (3/11)'))throw Error(t.slice(0,500));return true;});
  const json=JSON.parse(new TextDecoder().decode(await encode(snap,'json',{font})));
  s.check('json-'+lang,'JSON keeps the exact AST of the fraction divisor',()=>{const txt=JSON.stringify(json);if(!txt.includes('"numerator":"3","denominator":"11"'))throw Error('AST missing');return true;});
  const docx=unzip(await encode(snap,'docx',{font}));
  s.check('docx-omml-'+lang,'DOCX shows 3/11 as an editable stacked OMML fraction',()=>{const d=docx['word/document.xml'];if(!/<m:f>.*?<m:num>.*?3.*?<\/m:num>.*?<m:den>.*?11.*?<\/m:den>/s.test(d))throw Error('no OMML fraction 3/11');return true;});
}
s.finish(receiptPath('math-exports.json'));
