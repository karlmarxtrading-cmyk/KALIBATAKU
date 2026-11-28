import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,relative} from 'node:path';
const dir=resolve(process.argv[2] || 'dist');
async function walk(path) {
  const files=[];
  for(const entry of await readdir(path,{withFileTypes:true})) {
    const p=join(path,entry.name),name=relative(dir,p).replaceAll('\\','/');
    if(entry.isDirectory()){
      if(!['bank','teacher','tests','spec','evidence','journey/v1/occ'].includes(name))files.push(...await walk(p));
    }else if(/\.(?:mjs|js|css|woff2?|svg|html|webmanifest|json|png)$/.test(name)&&
      !['sw.js','404.html','offline-assets.json'].includes(name))files.push(name);
  }
  return files;
}
const hash=x=>createHash('sha256').update(x).digest('hex');
// Single source of version identity (UX-001). Settings, reports and QA read this file;
// it is part of the offline shell so the label stays correct offline.
const pkg=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'));
const bankIndex=JSON.parse(await readFile(join(dir,'bank/index.json'),'utf8'));
await writeFile(join(dir,'build-info.json'),JSON.stringify({app_version:pkg.version,bank_version:bankIndex.version,product:'KALIBATAKU'})+'\n');
const names=(await walk(dir)).sort();
for(const rootManifest of ['bank/manifest.json','bank/index.json','bank/root.json']){
  try{await readFile(join(dir,rootManifest));names.push(rootManifest);}catch{}
}
const assets=[];
for(const path of [...new Set(names)].sort()){
  const b=await readFile(join(dir,path));assets.push({path,bytes:b.length,sha256:hash(b)});
}
const catalogs={};
const index=JSON.parse(await readFile(join(dir,'bank/index.json'),'utf8'));
for(const {url} of index.grades){
  const g=await readFile(join(dir,url));catalogs[url]={bytes:g.length,sha256:hash(g)};
  for(const level of JSON.parse(g).levels){
    const b=await readFile(join(dir,level.url));catalogs[level.url]={bytes:b.length,sha256:hash(b)};
  }
}
const capabilities={practice:'installed-pack',teacher:'online',reports:'online',exports:'online'};
const source=await readFile(new URL('../../src/sw.js',import.meta.url),'utf8');
// Online-only screens still identify this build, without adding to the offline download.
const onlinePaths=[...(await walk(join(dir,'teacher'))),'404.html','_headers'].sort();
const online=[];
for(const path of onlinePaths) online.push([path,hash(await readFile(join(dir,path)))]);
const release=hash(JSON.stringify({assets,catalogs,capabilities,online,worker:hash(source)})).slice(0,16);
await writeFile(join(dir,'offline-assets.json'),JSON.stringify({release,assets,catalogs,capabilities})+'\n');
await writeFile(join(dir,'sw.js'),source.replace('__KALIBATAKU_BUILD__',release));
console.log('Offline manifest',release,assets.length,'assets',assets.reduce((s,x)=>s+x.bytes,0),'bytes');
