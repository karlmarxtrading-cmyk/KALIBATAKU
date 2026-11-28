// Verification lasts one view/page or one launch. A new cycle rereads the install
// index and current manifest. Shell and parsed dependencies are shared only within it.
import {offlineManifest,localURL,checkedBytes,verifiedShell,installRecords} from './offline.js';

const packageId=/^MM-G(\d{2})-L(\d{2})-(ADD|SUB|MUL|DIV|MIX)-P\d+$/;
const decode=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
const labels={
  absent:['Belum diunduh','Not downloaded'],checking:['Memeriksa salinan offline…','Checking offline copy…'],
  repair:['Perlu perbaikan','Repair needed'],update:['Perlu diperbarui','Update needed'],
  ready:['Tersedia offline','Available offline']
};
export const packageStateLabel=(state,translate)=>translate(...labels[state]);
export {watchInstalls} from './offline-events.js';

export async function packageInventory(signal,manifest){
  const records=await installRecords();
  if(manifest===undefined)manifest=records.length?await offlineManifest(signal).catch(e=>{signal?.throwIfAborted();return null;}):null;
  const groups=new Map();
  for(const record of records){
    const group=record.id.split('-P')[0];
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push(record);
  }
  const forNode=n=>groups.get('MM-G'+String(n.grade).padStart(2,'0')+'-L'+String(n.level).padStart(2,'0')+'-'+n.operation)||[];
  return {records,forNode,manifest,results:new Map(),assets:new Map(manifest?.assets.map(a=>[a.path,a])),signal,shells:new Map(),documents:new Map()};
}

async function documentIn(cycle,cache,name,path,spec){
  if(!spec)return null;
  const key=JSON.stringify([name,path,spec.sha256]);
  if(!cycle.documents.has(key)){
    cycle.documents.set(key,checkedBytes(cache,path,spec).then(bytes=>bytes?decode(bytes):null));
  }
  return cycle.documents.get(key);
}

async function inspect(cycle,r,node){
  const {manifest,assets,shells}=cycle,id=packageId.exec(r.id);
  if(!id||!manifest)return {state:'repair'};
  const shellName='kalibataku:'+localURL('./').pathname+':shell:'+manifest.release;
  if(r.shellCache!==shellName)return {state:'update'};
  if(!shells.has(shellName))shells.set(shellName,verifiedShell(shellName,manifest));
  if(!await shells.get(shellName)||!await caches.has(r.packCache))return {state:'repair'};
  const cache=await caches.open(r.packCache),marker=await cache.match(localURL('__pack_ready__'));
  if(!marker?.ok||await marker.text()!==manifest.release)return {state:'repair'};
  const json=(path,spec)=>documentIn(cycle,cache,r.packCache,path,spec);
  const index=await json('bank/index.json',assets.get('bank/index.json'));
  const g=index?.grades.find(g=>g.grade===+id[1]);
  if(!g)return {state:'repair'};
  const grade=await json(g.url,manifest.catalogs?.[g.url]),l=grade?.levels.find(l=>l.level===+id[2]);
  if(!l)return {state:'repair'};
  const level=await json(l.url,manifest.catalogs?.[l.url]);
  const cell=level?.competencies.find(c=>c.active&&c.operation===id[3]);
  const entry=cell?.packages.find(p=>p.package_id===r.id);
  if(!entry)return {state:'repair'};
  if(entry.content_version!==r.version)return {state:'update'};
  if(entry.sha256!==r.sha256||localURL(entry.url).href!==r.url)return {state:'repair'};
  if(!node){
    const shell=await caches.open(shellName),path='journey/v1/route.json';
    const route=await documentIn(cycle,shell,shellName,path,assets.get(path));
    node=route?.nodes.find(n=>n.competency_id===cell.competency_id&&n.active);
  }
  if(!node?.occ||node.competency_id!==cell.competency_id)return {state:'repair'};
  const shard=await json(node.occ.url,node.occ);
  const pack=shard?.packages.find(p=>p.package_id===r.id);
  if(!pack||shard.competency_id!==cell.competency_id||pack.content_version!==entry.content_version||pack.package_sha256!==entry.sha256)return {state:'repair'};
  const bytes=await checkedBytes(cache,entry.url,entry);
  return bytes?{state:'ready',shard,cell,entry,bytes}:{state:'repair'};
}

export async function verifyStored(cycle,record,node){
  cycle.signal?.throwIfAborted();
  if(!cycle.results.has(record))cycle.results.set(record,inspect(cycle,record,node).catch(e=>{cycle.signal?.throwIfAborted();return {state:'repair'};}));
  return cycle.results.get(record);
}

export async function verifyPackage(cycle,id,version){
  const copies=cycle.records.filter(r=>r.id===id);
  if(!copies.length)return {state:'absent'};
  const r=copies.find(r=>r.version===version)||copies[0];
  return verifyStored(cycle,r);
}

export function packageTarget(id){
  const parts=packageId.exec(id);
  return parts?{grade:+parts[1],level:+parts[2],op:parts[3],pack:id}:null;
}
