import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';

const project=fileURLToPath(new URL('../../',import.meta.url));
const dist=path.join(project,'dist');
const read=(file)=>readFile(path.join(dist,file),'utf8');
const checks=[];
let calls=[];
globalThis.document={baseURI:'https://static.example.edu/lesson/index.html'};
globalThis.fetch=async function(url){
  const u=new URL(url,document.baseURI);
  assert.equal(u.origin,'https://static.example.edu');assert.ok(u.pathname.startsWith('/lesson/bank/'));
  const local=u.pathname.slice('/lesson/'.length);calls.push(local);
  return {ok:true,json:async()=>JSON.parse(await read(local))};
};
const bank=await import('../../src/core/bank.mjs');
async function check(name,run){
  const detail=await run();
  checks.push({name,status:'PASS',...detail});
}
await check('catalogue resolves every pack and active competency from a nested path',async()=>{
  const root=await bank.rootShard();let grades=0,levels=0,active=0,disabled=0,packages=0,slots=0;
  for(const gr of root.grades){
    grades++;const grade=await bank.readShard(gr.url);
    for(const lm of grade.levels){
      levels++;const level=await bank.readShard(lm.url);
      for(const cell of level.competencies){
        if(!cell.active){disabled++;continue;}
        active++;
        for(const entry of cell.packages){
          const params=new URLSearchParams({grade:gr.grade,level:lm.level,op:cell.operation,pack:entry.package_id});
          const actual=await bank.selection({params});
          assert.equal(actual.entry.package_id,entry.package_id);
          assert.equal(actual.comp.competency_id,cell.competency_id);
          assert.equal(actual.entry.sha256.length,64);
          assert.ok(actual.entry.title.id&&actual.entry.title.en);
          const url=bank.safeBankURL(entry.url);
          assert.ok((await stat(path.join(dist,url.pathname.slice('/lesson/'.length)))).isFile());
          packages++;slots+=entry.question_count;
        }
      }
    }
  }
  assert.deepEqual([grades,levels,active,disabled,packages,slots],[12,60,281,19,root.package_count,root.question_slots]);
  assert.equal(calls.length,1+grades+levels);assert.ok(calls.every(p=>p.endsWith('.json')));
  return {grades,levels,active,disabled,packages,slots,distinct_metadata_requests:calls.length,question_packs_imported:0};
});
await check('invalid grade, level, pack and external paths do not open new resources',async()=>{
  for(const params of ['grade=0','grade=99','grade=1&level=6','grade=1&level=1&op=DIV','grade=1&level=1&op=ADD&pack=missing']){
    await assert.rejects(bank.selection({params:new URLSearchParams(params)}),/SELECTION/);
  }
  for(const external of ['https://other.invalid/bank/p.mjs','../bank/p.mjs','bank/../../escape.js','javascript:undefined','./assets/mark.svg'])assert.throws(()=>bank.safeBankURL(external),/BANK_PATH/);
  return {invalid_selections:5,invalid_paths:5};
});
await check('separately loadable shell locale dictionaries have matching labels and sizes',async()=>{
  const rawId=await read('locales/id.json'),rawEn=await read('locales/en.json');
  const id=JSON.parse(rawId),en=JSON.parse(rawEn);
  assert.deepEqual(Object.keys(id).sort(),Object.keys(en).sort());
  for(const key of Object.keys(id)){assert.ok(id[key].trim());assert.ok(en[key].trim());}
  const source=await Promise.all(['app.mjs','core/home.mjs','core/catalog.mjs','core/settings.mjs'].map(read));
  const keys=new Set(source.flatMap(s=>[...s.matchAll(/\bt\('([^']+)'\)/g)].map(m=>m[1])));
  for(const k of keys)assert.ok(id[k],k);
  const gzip_id=gzipSync(rawId).length,gzip_en=gzipSync(rawEn).length;
  assert.ok(gzip_id<25*1024&&gzip_en<25*1024);
  return {matching_keys:Object.keys(id).length,direct_call_keys:keys.size,gzip_id,gzip_en};
});
const css=await read('assets/base.css');
const rawBlocks=[css.match(/:root\{([^}]+)\}/)[1],css.match(/:root\[data-theme=dark\]\{([^}]+)\}/)[1]];
function colors(block){return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[a-f0-9]{3,6})[;}]/ig)].map(m=>[m[1],m[2]]));}
function lum(hex){let ch=hex.slice(1);if(ch.length===3)ch=[...ch].map(x=>x+x).join('');const c=[0,1,2].map(i=>parseInt(ch.slice(i*2,i*2+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];}
const combinations=[['text','surface',4.5],['textMuted','canvas',4.5],['onPrimary','primary',4.5],['successText','successBg',4.5],['warningText','warningBg',4.5],['errorText','errorBg',4.5],['infoText','infoBg',4.5],['borderControl','canvas',3],['focusRing','surface',3],['hero-soft','hero',4.5],['hero-text','hero',4.5],['ink','amber',4.5],['tile-a-ink','tile-a',3],['tile-b-ink','tile-b',3],['tile-c-ink','tile-c',3]];
await check('theme and custom illustration token contrast from actual stylesheet',async()=>{
  let map={};const measured={};
  for(const [i,theme] of ['light','dark'].entries()){
    Object.assign(map,colors(rawBlocks[i])); measured[theme]={};
    for(const [a,b,min] of combinations){const nums=[lum(map[a]),lum(map[b])].sort((x,y)=>y-x);const ratio=(nums[0]+.05)/(nums[1]+.05);assert.ok(ratio>=min,theme+' '+a+'/'+b+' '+ratio);measured[theme][a+'/'+b]=+ratio.toFixed(2);}
  }
  return {pairs:combinations.length*2,measured};
});
const report={scope:'Static catalogue routing, locale resources, real stylesheet token checks. Browser accessibility observations are separate.',checks};
if(process.argv.includes('--evidence'))await writeFile(path.join(project,'evidence/ui/catalog-and-tokens.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
