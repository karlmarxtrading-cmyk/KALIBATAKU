import {sha256,SAFE_ID,invariant,fail} from './common.js';
import {transaction,row,key,getStatus} from './db.js';
import {installationChanged} from './offline-events.js';
const root=new URL('../',import.meta.url),ns='offline:'+root.pathname;
const prefix='kalibataku:'+root.pathname+':';
let registration;
export async function registerOffline(){
  if(!globalThis.navigator?.serviceWorker || !globalThis.isSecureContext)return null;
  if(!registration)registration=navigator.serviceWorker.register(new URL('sw.js',root),{scope:root.pathname,updateViaCache:'none'}).catch(e=>{registration=null;throw e;});
  return registration;
}
export function localURL(path) {
  const u=new URL(path,root);
  invariant(u.origin===root.origin&&u.href.startsWith(root.href)&&!u.search&&!u.hash,'INVALID_ASSET');
  return u;
}
async function verified(url,digest,signal) {
  const response=await fetch(url,{cache:'no-store',credentials:'same-origin',redirect:'error',headers:{'X-Kalibataku-Verify':'1'},signal});
  invariant(response.ok&&response.type!=='opaque','DOWNLOAD_FAILED');
  const bytes=await response.arrayBuffer();
  if(digest)invariant(await sha256(bytes)===digest,'CHECKSUM_MISMATCH');
  // Content-encoding and length refer to the transport, not to the decoded body.
  const h=new Headers(response.headers);h.delete('content-encoding');h.delete('content-length');
  return {response:new Response(bytes,{headers:h}),size:bytes.byteLength};
}
async function cachedAll(cacheName,urls) {
  if(typeof cacheName!=='string'||!Array.isArray(urls)||!urls.length||!await caches.has(cacheName))return false;
  const cache=await caches.open(cacheName);
  return (await Promise.all(urls.map(url=>cache.match(url).then(Boolean)))).every(Boolean);
}
export async function installRecords(){
  if(!globalThis.caches)return [];
  const rows=await transaction(['installs'],false,tx=>tx.all('installs',ns));
  return rows.map(r=>r.data);
}
export async function inspectInstalled(manifest){
  const {packageInventory,verifyStored}=await import('./offline-verification.mjs');
  const inventory=await packageInventory(undefined,manifest);
  return Promise.all(inventory.records.map(async r=>{
    const {state}=await verifyStored(inventory,r);
    // Compatibility with the original public inspection API.
    return {...r,state:state==='repair'?'missing':state};
  }));
}
export async function listInstalled(){
  return (await inspectInstalled()).filter(r=>r.state==='ready');
}
export async function offlineManifest(signal){
  const response=await fetch(new URL('offline-assets.json',root),{cache:'no-cache',signal});
  invariant(response.ok,'DOWNLOAD_FAILED');
  const manifest=await response.json();
  invariant(/^[a-f0-9]{16}$/.test(manifest.release)&&Array.isArray(manifest.assets)&&manifest.assets.length>0&&manifest.assets.length<500,'INVALID_ASSET');
  return manifest;
}
function sources(info,manifest){
  const assets=new Map(manifest.assets.map(a=>[localURL(a.path).href,a]));
  const catalogs=new Map(Object.entries(manifest.catalogs||{}).map(([path,a])=>[localURL(path).href,a]));
  const pack=new Map();
  for(const dep of info.dependencies||[]){
    const url=localURL(typeof dep==='string'?dep:dep.url).href,known=catalogs.get(url)||assets.get(url);
    invariant((url.startsWith(new URL('bank/',root).href)||url.startsWith(new URL('journey/v1/occ/',root).href))&&url.endsWith('.json'),'INVALID_ASSET');
    pack.set(url,{sha256:known?.sha256||dep?.sha256,bytes:known?.bytes??dep?.bytes??null});
  }
  const url=localURL(info.url).href;
  invariant(url.startsWith(new URL('bank/',root).href)&&/\.m?js$/.test(url),'INVALID_ASSET');
  pack.set(url,{bytes:info.bytes||null,sha256:info.sha256});
  return {assets,pack};
}
export async function checkedBytes(cache,path,spec){
  if(!spec||!Number.isSafeInteger(spec.bytes)||spec.bytes<1)return null;
  const hit=await cache.match(localURL(path));
  if(!hit?.ok)return null;
  const bytes=await hit.arrayBuffer();
  return bytes.byteLength===spec.bytes&&await sha256(bytes)===spec.sha256?bytes:null;
}

export async function verifiedShell(cacheName,manifest){
  if(!manifest||cacheName!==prefix+'shell:'+manifest.release||!await caches.has(cacheName))return false;
  const shell=await caches.open(cacheName);
  const marker=await shell.match(localURL('offline-assets.json'));
  if(!marker?.ok)return false;
  const pinned=await marker.json();
  if(pinned.release!==manifest.release||JSON.stringify(pinned.assets)!==JSON.stringify(manifest.assets)||JSON.stringify(pinned.catalogs)!==JSON.stringify(manifest.catalogs))return false;
  const matches=await Promise.all(manifest.assets.map(async a=>!!await checkedBytes(shell,a.path,a)));
  return matches.every(Boolean);
}

async function withMissionDependency(info,signal){
  // API callers may still supply the original three catalog paths. New
  // installs also pin the current occurrence shard, including formal packs.
  if(!info.dependencies?.some(d=>(d.url||d).startsWith('journey/v1/occ/'))){
    const {packageTarget}=await import('./offline-verification.mjs'),target=packageTarget(info.id);
    if(target){
      const {loadRoute}=await import('../journey/journey.mjs');
      const node=(await loadRoute(signal)).nodes.find(n=>n.grade===target.grade&&n.level===target.level&&n.operation===target.op&&n.active);
      invariant(node?.occ,'INVALID_PACKAGE');
      info={...info,dependencies:[...(info.dependencies||[]),node.occ]};
    }
  }
  return info;
}
export async function downloadPlan(info,manifest){
  info=await withMissionDependency(info);
  manifest??=await offlineManifest();
  const {assets,pack}=sources(info,manifest),name=prefix+'shell:'+manifest.release;
  const cache=globalThis.caches&&await caches.has(name)?await caches.open(name):null;
  let pending=0,shared=0,unknown=false;
  for(const [url,a] of assets){
    if(cache&&await cache.match(url))shared+=a.bytes;
    else pending+=a.bytes;
  }
  // Duplicate dependencies already present in the shell are copied locally.
  for(const [url,a] of pack)if(!assets.has(url)){
    if(a.bytes==null)unknown=true;else pending+=a.bytes;
  }
  return {bytes:unknown?null:pending,shared,complete:!unknown,assets:assets.size,dependencies:pack.size};
}
export async function removeInstalled(id,version) {
  const k=key(ns,id+'@'+version);
  const record=await transaction(['installs'],true,async tx=>{const r=await tx.get('installs',k);if(r)await tx.del('installs',k);return r?.data;});
  if(record){await caches.delete(record.packCache);installationChanged();}
}
// Ask the active worker to apply the retention policy (TECH-04). The worker knows the
// release it serves; a page may already see a newer manifest on the network.
export async function pruneOfflineCaches({timeout=8000}={}){
  const reg=await registerOffline().catch(()=>null);
  const worker=reg?.active;if(!worker)return {skipped:'no-active-worker'};
  return new Promise(resolve=>{
    const ch=new MessageChannel(),t=setTimeout(()=>resolve({skipped:'timeout'}),timeout);
    ch.port1.onmessage=({data})=>{clearTimeout(t);resolve(data);};
    worker.postMessage({type:'kalibataku-gc'},[ch.port2]);
  });
}
const LOCK='kalibataku-offline-install:'+root.pathname;
export async function installPackage(info,opts={}){
  // The same lock makes the worker skip cache collection while files are downloading.
  if(globalThis.navigator?.locks?.request)return navigator.locks.request(LOCK,()=>installLocked(info,opts));
  return installLocked(info,opts);
}
async function installLocked(info,{signal,onProgress=()=>{}}={}) {
  const reg=await registerOffline();
  invariant(globalThis.caches && reg,'OFFLINE_UNAVAILABLE');
  invariant(!(await getStatus()).temporary,'STORAGE_UNAVAILABLE');
  if(!reg.active){
    const worker=reg.installing || reg.waiting;
    invariant(worker,'OFFLINE_UNAVAILABLE');
    await new Promise((resolve,reject)=>{
      const changed=()=>{if(worker.state==='activated'||worker.state==='redundant'){
        worker.removeEventListener('statechange',changed);worker.state==='activated'?resolve():reject(new Error('OFFLINE_UNAVAILABLE'));
      }};
      worker.addEventListener('statechange',changed);changed();
    });
  }
  const {id,version,sha256:digest}=info;
  invariant(typeof id==='string'&&SAFE_ID.test(id)&&typeof version==='string'&&SAFE_ID.test(version)&&/^[a-f0-9]{64}$/.test(digest),'INVALID_PACKAGE');
  const manifest=await offlineManifest(signal);
  info=await withMissionDependency(info,signal);
  const {assets,pack:files}=sources(info,manifest);
  const shellCache=prefix+'shell:'+manifest.release,shellUrls=[...assets.keys()];
  const packageUrl=localURL(info.url).href;
  const packCache=prefix+'ready-pack:'+manifest.release+':'+id+'@'+version+':'+crypto.randomUUID(),packUrls=[...files.keys()];
  let count=0,bytes=0,packageBytes=0;
  const maximum=assets.size+files.size,estimate=await downloadPlan(info,manifest);
  const notify=()=>onProgress({done:count,total:maximum,bytes,totalBytes:estimate.bytes});
  const storage=await navigator.storage?.estimate?.().catch(()=>null);
  if(estimate.bytes && storage?.quota && storage.quota-(storage.usage||0)<estimate.bytes)fail('QUOTA_EXCEEDED');
  notify();
  try{
    const cache=await caches.open(shellCache);
    for(const asset of manifest.assets){
      signal?.throwIfAborted();
      const url=localURL(asset.path);
      const previous=await cache.match(url);
      if(!previous||await sha256(await previous.arrayBuffer())!==asset.sha256) {
        const resource=await verified(url,asset.sha256,signal);await cache.put(url,resource.response);bytes+=resource.size;
      }
      count++;notify();
    }
    await cache.put(new URL('offline-assets.json',root),new Response(JSON.stringify(manifest),{headers:{'Content-Type':'application/json'}}));
    const destination=await caches.open(packCache);
    for(const [url,asset] of files){
      signal?.throwIfAborted();
      const shared=assets.has(url)?await cache.match(url):null;
      if(shared)await destination.put(url,shared);
      else{
        const resource=await verified(url,asset.sha256,signal);
        await destination.put(url,resource.response);if(url===packageUrl)packageBytes=resource.size;bytes+=resource.size;
      }
      count++;notify();
    }
    signal?.throwIfAborted();
    invariant(await cachedAll(shellCache,shellUrls)&&await cachedAll(packCache,packUrls),'CACHE_INCOMPLETE');
    await destination.put(new URL('__pack_ready__',root),new Response(manifest.release));
    const meta={id,version,url:packageUrl,sha256:digest,dependencies:info.dependencies||[],shellUrls,shellCache,packUrls,packCache,
      bytes:packageBytes,transfer_bytes:bytes,capabilities:{practice:true,teacher:false,reports:false,exports:false},installed_at:new Date().toISOString(),title:info.title||id,launch:info.launch||null};
    const old=await transaction(['installs'],true,async tx=>{
      const r=row(ns,id+'@'+version,meta);
      const stale=(await tx.all('installs',ns)).filter(other=>other.data.id===id);
      for(const other of stale)if(other.key!==r.key)await tx.del('installs',other.key);
      await tx.put('installs',r);return stale.map(other=>other.data.packCache);
    });
    // The committed receipt now identifies the new cache. Cleanup failure must
    // never discard that cache; the worker can collect obsolete names later.
    await Promise.all(old.map(name=>caches.delete(name).catch(()=>false)));
    installationChanged();
    return meta;
  }catch(e){await caches.delete(packCache);throw e;}
}
