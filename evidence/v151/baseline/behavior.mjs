// Adapter only. Expected outcomes and timestamp arithmetic are calculated in Python.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const chunks=[];
for await(const chunk of process.stdin) chunks.push(chunk);
const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
const dist=path.resolve(process.argv[2]);
const location=pathToFileURL(dist+'/');
const moduleAt=name=>import(new URL(name,location));
const disk=name=>readFile(new URL(name,location));
const json=async name=>JSON.parse(await disk(name));
const {exposure,journeyState,nextMission}=await moduleAt('journey/model.mjs');
const {journeySummary}=await moduleAt('journey/report.mjs');
const {periodBounds,filterSessions,initialFilters}=await moduleAt('teacher/report.js');
const route=await json('journey/v1/route.json'),attempts=body.sparse;
const nodeId=attempts[0].target_competency_id;
const sparse=attempts.map((_,i)=>{
  const part=attempts.slice(0,i+1),state=journeyState(route,part);
  const current=state.nodes.get(nodeId);
  const summary=journeySummary(part).rows.find(x=>x.node_id===nodeId);
  return {selector:[...exposure(part,nodeId).entries()].sort(),map:[...current.seen].sort(),report:summary.unique_seen,ready:current.ready,next:nextMission(route,state).node_id};
});
const civil=body.civil.map(r=>{
  const f={...initialFilters(),source:'local_practice',timezone:r.zone,from:r.day,to:r.day};
  const rows=r.records.map(a=>({...a,data_origin:'local_practice',profile_id:'p'}));
  return {zone:r.zone,day:r.day,bounds:periodBounds(f),selected:filterSessions(rows,[{id:'p'}],f).map(a=>a.attempt_id)};
});
const {packageInventory,verifyPackage}=await moduleAt('data/offline-verification.mjs');
const {localURL}=await moduleAt('data/offline.js');
const manifest=await json('offline-assets.json');
const index=await json('bank/index.json'),g=index.grades[0],grade=await json(g.url);
const l=grade.levels[0],level=await json(l.url),cell=level.competencies.find(x=>x.active);
const entry=cell.packages[0],node=route.nodes.find(x=>x.competency_id===cell.competency_id);
const shellName='kalibataku:'+localURL('./').pathname+':shell:'+manifest.release;
const packName='independent-test-package';
const record={id:entry.package_id,sha256:entry.sha256,version:entry.content_version,url:localURL(entry.url).href,shellCache:shellName,packCache:packName};
const shellFiles=new Map(),packFiles=new Map();
for(const a of manifest.assets)shellFiles.set(localURL(a.path).href,await disk(a.path));
shellFiles.set(localURL('offline-assets.json').href,await disk('offline-assets.json'));
for(const file of ['bank/index.json',g.url,l.url,node.occ.url,entry.url])packFiles.set(localURL(file).href,await disk(file));
packFiles.set(localURL('__pack_ready__').href,Buffer.from(manifest.release));
const faultyCases=[
  ['intact'],['absent'],['prior-release'],
  ['occurrence hash',packFiles,node.occ.url,'alter'],['package hash',packFiles,entry.url,'alter'],
  ['package missing',packFiles,entry.url,'drop'],['grade catalog hash',packFiles,g.url,'alter'],
  ['level catalog missing',packFiles,l.url,'drop'],['index missing',packFiles,'bank/index.json','drop'],
  ['shell app hash',shellFiles,'app.mjs','alter'],['marker stale',packFiles,'__pack_ready__','alter'],['repaired']
];
const offline=[];
for(const [kind,target,file,op] of faultyCases){
  const resources=new Map([[shellName,new Map(shellFiles)],[packName,new Map(packFiles)]]);
  if(target){
    const files=resources.get(target===shellFiles?shellName:packName),url=localURL(file).href;
    if(op==='drop')files.delete(url);
    else{
      const contents=Buffer.from(files.get(url));contents[Math.floor(contents.length/2)]^=1;files.set(url,contents);
    }
  }
  const r={...record,shellCache:kind==='prior-release'?shellName+'-old':shellName};
  let reads=0;
  globalThis.caches={
    has:async key=>resources.has(key),open:async key=>({
      match:async req=>{reads++;const data=resources.get(key)?.get(String(req));return data&&new Response(data);}
    })
  };
  const inventory=await packageInventory(undefined,manifest);
  inventory.records=kind==='absent'?[]:[r];
  const result=await verifyPackage(inventory,r.id,r.version);
  offline.push({case:kind,state:result.state,reads});
}
console.log(JSON.stringify({sparse,civil,offline}));
