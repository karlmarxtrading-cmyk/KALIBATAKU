const ROOT=new URL('../',import.meta.url);
// A connected adapter can still have no route to the app's origin (for
// example after an offline reload). HEAD bypasses our GET-only service worker.
export async function originAvailable(signal){
  if(globalThis.navigator?.onLine===false)return false;
  if(!globalThis.navigator?.serviceWorker?.controller)return true;
  const timeout=new AbortController(),stop=()=>timeout.abort();
  const handle=setTimeout(stop,2500);
  signal?.throwIfAborted();
  signal?.addEventListener('abort',stop,{once:true});
  try{
    const response=await fetch(new URL('build-info.json',ROOT),{method:'HEAD',cache:'no-store',signal:timeout.signal});
    return response.ok||response.status===405;
  }catch{
    signal?.throwIfAborted();return false;
  }finally{
    clearTimeout(handle);signal?.removeEventListener('abort',stop);
  }
}
