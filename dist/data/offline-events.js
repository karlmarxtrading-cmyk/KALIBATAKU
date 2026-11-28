// Scoped to installations for this deployed path. Each view listens until navigation.
const channelName='kalibataku-offline-changes:'+new URL('../',import.meta.url).pathname;
let channel;
function notifications(){
  try{if(!channel&&globalThis.window&&globalThis.BroadcastChannel)channel=new BroadcastChannel(channelName);}catch{}
  return channel;
}
export function installationChanged(){
  globalThis.window?.dispatchEvent(new Event(channelName));
  try{notifications()?.postMessage('changed');}catch{}
}
const watching=new WeakMap();
export function watchInstalls(signal,refresh){
  if(!signal||signal.aborted)return;
  // A panel can redraw many times with the same navigation signal.
  const current=watching.get(signal);
  if(current){current.refresh=refresh;return;}
  const slot={refresh};watching.set(signal,slot);
  const listener=()=>slot.refresh();
  const opts={signal};
  globalThis.window?.addEventListener(channelName,listener,opts);
  notifications()?.addEventListener('message',listener,opts);
  const workers=globalThis.navigator?.serviceWorker;
  let previous=workers?.controller,wasControlled=Boolean(previous);
  workers?.addEventListener('controllerchange',()=>{
    const next=workers.controller;
    if(next===previous)return;
    const invalidate=wasControlled;
    previous=next;wasControlled||=Boolean(next);
    // First claim attaches this document to its worker without changing any
    // installed content. A later controller replacement invalidates the view.
    if(invalidate)listener();
  },opts);
}

