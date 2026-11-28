// Node-only reproduction with production modules and an in-memory DOM/Cache adapter.
// It tests capability-label consistency, not rendering or a physical browser.
// Usage: node probe-offline-readiness.mjs /absolute/source/root [output.json]
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
if(!process.argv[2])throw new Error('Usage: node probe-offline-readiness.mjs SOURCE_ROOT [OUTPUT_JSON]');
const ROOT=pathToFileURL(resolve(process.argv[2])+'/');
const dist=new URL('dist/',ROOT);
class El {
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.className='';}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.className=String(v);}
  append(...v){this.children.push(...v);}
  replaceChildren(...v){this.children=[...v];}
  addEventListener(){}
  querySelector(){return null;}
  get textContent(){return this.children.map(c=>typeof c==='object'?c.textContent:String(c)).join(' ');}
  set textContent(v){this.children=[String(v)];}
}
globalThis.document={baseURI:dist.href,createElement:t=>new El(t),createElementNS:(_,t)=>new El(t)};
globalThis.location=new URL(dist);
globalThis.requestAnimationFrame=()=>{};
Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
const storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
globalThis.sessionStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const cacheMaps=new Map();
globalThis.caches={has:async n=>cacheMaps.has(n),open:async n=>({match:async u=>cacheMaps.get(n)?.has(String(u))?new Response('present'):undefined})};
const requests=[];
globalThis.fetch=async u=>{
  const url=new URL(u,dist);requests.push(url.href);
  const cached=[...cacheMaps.values()].some(set=>set.has(url.href));
  if(!navigator.onLine&&!cached)return new Response('Not cached',{status:404});
  return new Response(await readFile(url),{status:200});
};
const db=await import(new URL('data/db.js',dist));
const store=await import(new URL('data/store.js',dist));
const offline=await import(new URL('data/offline.js',dist));
const ui=await import(new URL('journey/ui.mjs',dist));
const journey=await import(new URL('journey/journey.mjs',dist));
const manifest=JSON.parse(await readFile(new URL('offline-assets.json',dist)));
const route=JSON.parse(await readFile(new URL('journey/v1/route.json',dist)));
const node=route.nodes.find(n=>n.competency_id==='arithmetic.addition.g01.l01');
const catalog=JSON.parse(await readFile(new URL('bank/g01/l01.json',dist)));
const packages=catalog.competencies.find(n=>n.competency_id===node.competency_id).packages;
const teaching=packages.find(p=>p.package_id.endsWith('P001'));
const assessment=packages.find(p=>p.form_id)||packages.find(p=>p.package_id.includes('-A'));
const ns='offline:'+dist.pathname;
const results=[];
function walk(e,fn){if(typeof e!=='object')return;fn(e);for(const c of e.children)walk(c,fn);}
async function scenario(name,pkg,includeOccurrence,expected='REJECTED'){
  await db.transaction(['installs'],true,async tx=>{for(const r of await tx.all('installs',ns))await tx.del('installs',r.key);});
  cacheMaps.clear();
  const shellUrls=manifest.assets.map(a=>new URL(a.path,dist).href);
  const dependencies=['bank/index.json','bank/g01.json','bank/g01/l01.json'];
  if(includeOccurrence)dependencies.push(node.occ.url);
  const packUrls=[...dependencies,pkg.url].map(p=>new URL(p,dist).href);
  cacheMaps.set('shell',new Set(shellUrls));cacheMaps.set('pack',new Set(packUrls));
  const record={id:pkg.package_id,version:pkg.content_version,url:new URL(pkg.url,dist).href,sha256:pkg.sha256,shellUrls,shellCache:'shell',packUrls,packCache:'pack',dependencies};
  await db.transaction(['installs'],true,tx=>tx.put('installs',db.row(ns,pkg.package_id+'@'+pkg.content_version,record)));
  const root=new El('main'),scope=await store.resolveActiveScope();
  const ctx={root,L:(id,en)=>id,scope,lang:'id',profileName:'Offline audit',params:new URLSearchParams(),signal:new AbortController().signal};
  await ui.map(ctx);
  let box,firstNode;
  walk(root,e=>{if(e.className.includes('offline-mission'))box=e;if(e.className.startsWith('map-node')&&!firstNode)firstNode=e;});
  const buttons=[];walk(box,e=>{if(e.tagName==='button')buttons.push(e.textContent);});
  let actual;
  try {actual={status:'CREATED',id:await journey.createMission(ctx,{nodeId:node.competency_id,kind:'intro'})};}
  catch(e){actual={status:'REJECTED',code:e.code||e.message,message:e.message};}
  results.push({name,expected,installed_package:pkg.package_id,form_id:pkg.form_id||null,dependencies,occurrence_dependency_present:includeOccurrence,
    listInstalled:(await offline.listInstalled()).map(p=>p.id),
    map_status:firstNode?.className,offline_message:box?.textContent,download_buttons:buttons,actual});
}
await scenario('Catalogue-installed teaching pack without journey occurrence shard',teaching,false);
if(assessment)await scenario('Only an assessment pack, even with the journey shard present',assessment,true);
await scenario('Positive control: teaching pack plus journey occurrence shard',teaching,true,'CREATED');
const out={runtime:process.version,scope:'Production dist modules, Node memory store, minimal DOM and Cache adapters; no browser, no physical-device claim',results};
const output=process.argv[3]||fileURLToPath(new URL('offline-readiness-probe.json',import.meta.url));
await writeFile(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
if(results.some(x=>x.actual.status!==x.expected||!x.offline_message.includes('sudah tersimpan')))process.exitCode=1;
