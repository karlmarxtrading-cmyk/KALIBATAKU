// Only this QA document redirects the app database to a unique synthetic database.
const q=new URLSearchParams(location.search),dbName=q.get('database');
if(!/^qa-kalibataku-[0-9a-f-]{36}$/.test(dbName))throw Error('QA database required');
const original=window.indexedDB,base=new URL(q.get('base'),location.href);
if(base.origin!==location.origin)throw Error('same-origin required');
if(q.get('blocked')==='1')Object.defineProperty(window,'indexedDB',{value:undefined});
else Object.defineProperty(window,'indexedDB',{value:new Proxy(original,{get(target,prop){
  if(prop==='open')return (name,version)=>target.open(name==='kalibataku-learning'?dbName:name,version);
  const item=Reflect.get(target,prop,target);return typeof item==='function'?item.bind(target):item;
}})});
const load=path=>import(new URL(path,base));
window.qaData={load,base:base.href,dbName};
