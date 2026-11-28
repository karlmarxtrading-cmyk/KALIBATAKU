// Drafts are private to a browser tab, keyed by the source, route and subject.
// Closing the tab ends the draft session. If sessionStorage is unavailable,
// the same state survives route and language changes in this document.
const cache=new Map(), prefix='kalibataku.teacher.1.1:';
export function draftFor(key,initial={}) {
  if(cache.has(key))return cache.get(key);
  let stored={};
  try{const value=JSON.parse(sessionStorage.getItem(prefix+key));if(value&&typeof value==='object'&&!Array.isArray(value))stored=value;}catch{}
  const draft={...initial,...stored};cache.set(key,draft);return draft;
}
export function remember(key,draft) {
  cache.set(key,draft);
  try{sessionStorage.setItem(prefix+key,JSON.stringify(draft));}catch{}
}
export function forget(key) {
  cache.delete(key);try{sessionStorage.removeItem(prefix+key);}catch{}
}
