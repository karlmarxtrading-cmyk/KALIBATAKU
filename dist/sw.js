// Clients using this worker keep the same revision until they close their tabs.
const RELEASE='f630b3dc6aa6b5a5';
const scope=self.registration.scope;
const prefix='kalibataku:'+new URL(scope).pathname+':';
const shellCache=prefix+'shell:'+RELEASE;
const shellMarker=new URL('offline-assets.json',scope).href;
const packMarker=new URL('__pack_ready__',scope).href;
importScripts('cache-policy.js');
const LOCK='kalibataku-offline-install:'+new URL(scope).pathname;
// A new worker activates only after every client of the previous worker has closed,
// so caches of older releases are no longer in use by an open tab at this point.
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([self.clients.claim(),collect('activate').catch(()=>null)]));});
self.addEventListener('message',event=>{
  if(event.data?.type!=='kalibataku-gc'||new URL(event.origin||scope).origin!==new URL(scope).origin)return;
  event.waitUntil(collect('request').then(r=>event.ports[0]?.postMessage(r),e=>event.ports[0]?.postMessage({error:String(e?.message||e)})));
});
// Install records, or null when they cannot be read (then nothing is removed).
function installRecords(){
  return new Promise(resolve=>{
    let open;try{open=indexedDB.open('kalibataku-learning');}catch{resolve(null);return;}
    open.onupgradeneeded=()=>{open.transaction.abort();};
    open.onerror=()=>resolve(open.error?.name==='AbortError'?[]:null);
    open.onsuccess=()=>{
      const db=open.result;
      if(!db.objectStoreNames.contains('installs')){db.close();resolve([]);return;}
      try{const r=db.transaction('installs').objectStore('installs').index('scope').getAll('offline:'+new URL(scope).pathname);
        r.onsuccess=()=>{db.close();resolve(r.result.map(v=>v.data));};r.onerror=()=>{db.close();resolve(null);};}
      catch{db.close();resolve(null);}
    };
  });
}
async function collect(reason){
  const run=async lock=>{
    const names=await caches.keys(),complete=[];
    for(const n of names.filter(n=>n.startsWith(prefix))){
      const marker=n.startsWith(prefix+'shell:')?shellMarker:packMarker;
      if(await caches.match(marker,{cacheName:n}))complete.push(n);
    }
    const decision=self.KalibatakuCachePolicy.plan({prefix,release:RELEASE,names,complete,installs:await installRecords(),locked:lock===null});
    for(const n of decision.remove)await caches.delete(n);
    return {reason,release:RELEASE,...decision};
  };
  return self.navigator?.locks?.request?self.navigator.locks.request(LOCK,{ifAvailable:true},run):run(true);
}

// v1.0 packages did not have completion markers. The existing install records
// identify which vintage caches finished installation. Never create a new DB here.
async function oldInstalls(){
  try{
    return await new Promise(resolve=>{
      const open=indexedDB.open('kalibataku-learning');
      open.onupgradeneeded=()=>open.transaction.abort();
      open.onerror=()=>resolve([]);
      open.onsuccess=()=>{
        const db=open.result;
        if(!db.objectStoreNames.contains('installs')){db.close();resolve([]);return;}
        const tx=db.transaction('installs'),r=tx.objectStore('installs').index('scope').getAll('offline:'+new URL(scope).pathname);
        r.onsuccess=()=>{db.close();resolve(r.result.map(v=>v.data));};
        r.onerror=()=>{db.close();resolve([]);};
      };
    });
  }catch{return [];}
}
// Recover an affected file from the origin even when the bad file is the app
// entry module. Only the bytes identified by the controlling release may replace it.
let pinnedAssets;
async function shellResponse(exact,marker){
  if(exact===shellMarker)return marker;
  if(!pinnedAssets){
    const manifest=await marker.json().catch(()=>null);
    if(manifest?.release!==RELEASE||!Array.isArray(manifest.assets))return null;
    pinnedAssets=new Map(manifest.assets.map(a=>[new URL(a.path,scope).href,a]));
  }
  const expected=pinnedAssets.get(exact);
  if(!expected)return null;
  async function matches(response){
    if(!response?.ok)return false;
    const bytes=await response.clone().arrayBuffer();
    if(bytes.byteLength!==expected.bytes)return false;
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')===expected.sha256;
  }
  const saved=await caches.match(exact,{cacheName:shellCache});
  if(await matches(saved))return saved;
  try{
    const live=await fetch(exact,{cache:'no-store',credentials:'same-origin',redirect:'error'});
    if(await matches(live)){
      const cache=await caches.open(shellCache);
      await cache.put(exact,live.clone());
      return live;
    }
  }catch{}
  const message='Sambungkan internet dan muat ulang aplikasi. / Reconnect and reload the app.';
  return new Response(message,{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==new URL(scope).origin||!url.href.startsWith(scope)||
    url.search||req.headers.has('X-Kalibataku-Verify')||req.headers.has('authorization'))return;
  const path=url.pathname.slice(new URL(scope).pathname.length);
  const isPage=req.mode==='navigate' && (path===''||path==='index.html');
  if(!isPage && (!/^[\w/.-]+\.(?:mjs|js|css|woff2?|svg|html|webmanifest|json|png)$/.test(path)||
    path==='sw.js'||path.startsWith('api/')))return;
  event.respondWith((async()=>{
    const exact=isPage?new URL('index.html',scope).href:req.url;
    const mutableCatalog=path==='offline-assets.json'||path.startsWith('bank/')&&path.endsWith('.json');
    let offlineResponse;
    if(mutableCatalog){
      try{const live=await fetch(req,{cache:'no-cache'});if(live.ok || live.status===404)return live;offlineResponse=live;}catch{}
    }
    const marker=await caches.match(shellMarker,{cacheName:shellCache});
    if(marker){
      const pinned=await shellResponse(exact,marker);
      if(pinned)return pinned;
    }
    let names,legacy;
    if(path.startsWith('bank/')||path.startsWith('journey/v1/occ/')){
      names=(await caches.keys()).reverse();
      const ready=names.filter(k=>k.startsWith(prefix+'ready-pack:')),preferred=prefix+'ready-pack:'+RELEASE+':';
      for(const k of [...ready.filter(k=>k.startsWith(preferred)),...ready.filter(k=>!k.startsWith(preferred))]){
        if(!await caches.match(packMarker,{cacheName:k}))continue;
        const hit=await caches.match(exact,{cacheName:k});if(hit)return hit;
      }
      if(names.some(k=>k.startsWith(prefix+'pack:'))){
        legacy=await oldInstalls();
        for(const r of legacy.filter(x=>x.packCache.startsWith(prefix+'pack:'))){
          const hit=await caches.match(exact,{cacheName:r.packCache});if(hit)return hit;
        }
      }
    }
    try{if(!mutableCatalog){const response=await fetch(req);if(response.ok||response.status===404)return response;offlineResponse=response;}}catch{}
    // Only fall back to a verified prior shell while offline; intermediate
    // downloads from a new release cannot supply a partial app.
    names??=(await caches.keys()).reverse();
    for(const k of names.filter(k=>k.startsWith(prefix+'shell:')&&k!==shellCache)){
      if(!await caches.match(shellMarker,{cacheName:k})){
        legacy??=await oldInstalls();if(!legacy.some(r=>r.shellCache===k))continue;
      }
      const hit=await caches.match(exact,{cacheName:k});if(hit)return hit;
    }
    return offlineResponse||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  })());
});
