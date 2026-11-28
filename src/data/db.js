import {fail} from './common.js';
export const DB_NAME='kalibataku-learning';
export const DB_VERSION=2;
export const TABLES=['profiles','attempts','events','outbox','leases','records','installs','mockBindings','mockInbox'];
const status={temporary:false, reason:null};
let connection;
const memory=new Map(TABLES.map(t=>[t,new Map()]));
let memoryQueue=Promise.resolve();
function signal(reason) {
  status.reason=reason;
  if(typeof window!=='undefined') window.dispatchEvent(new CustomEvent('kalibataku:storage',{detail:{...status}}));
}
function connect() {
  if(!connection) connection=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){status.temporary=true;signal('STORAGE_UNAVAILABLE');resolve(null);return;}
    let request;
    try {request=indexedDB.open(DB_NAME,DB_VERSION);} catch {status.temporary=true;signal('STORAGE_UNAVAILABLE');resolve(null);return;}
    let blocked=false;
    request.onblocked=()=>{blocked=true;signal('UPGRADE_BLOCKED');const e=new Error('UPGRADE_BLOCKED');e.code=e.message;reject(e);};
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const table of TABLES) {
        const store=db.objectStoreNames.contains(table)? request.transaction.objectStore(table) : db.createObjectStore(table,{keyPath:'key'});
        if(!store.indexNames.contains('scope')) store.createIndex('scope','scope');
        if(table==='events'&&!store.indexNames.contains('attempt')) store.createIndex('attempt',['scope','data.attempt_id']);
      }
    };
    request.onerror=()=>{
      const code=request.error?.name;
      if(['SecurityError','InvalidStateError','UnknownError','QuotaExceededError'].includes(code)) {
        status.temporary=true;signal('STORAGE_UNAVAILABLE');resolve(null);
      } else {signal('UPGRADE_FAILED');reject(request.error);}
    };
    request.onsuccess=()=>{
      const db=request.result;
      if(blocked){db.close();connection=undefined;return;}
      db.onversionchange=()=>{db.close();connection=undefined;signal('VERSION_CHANGED');};
      db.onclose=()=>{connection=undefined;};
      status.temporary=false;signal(null);resolve(db);
    };
  });
  return connection;
}
export async function getStatus(){await connect();return {...status};}
function fromRequest(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function memoryView(map,write) {
  const check=t=>{if(!write || !map.has(t))fail('READ_ONLY');};
  return {
    get:async(t,k)=>structuredClone(map.get(t).get(k)),
    put:async(t,r)=>{check(t);map.get(t).set(r.key,structuredClone(r));},
    del:async(t,k)=>{check(t);map.get(t).delete(k);},
    all:async(t,s)=>structuredClone([...map.get(t).values()].filter(x=>s===undefined||x.scope===s)),
    prefix:async(t,p)=>structuredClone([...map.get(t).values()].filter(x=>x.key.startsWith(p))),
    count:async(t,s)=>[...map.get(t).values()].filter(r=>r.scope===s).length,
    scan:async(t,s,visit,direction='next')=>{
      const records=[...map.get(t).values()].filter(r=>r.scope===s).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
      if(direction==='prev')records.reverse();
      for(const rec of records)if(await visit(structuredClone(rec))===false)break;
    },
    forAttempt:async(s,id)=>structuredClone([...map.get('events').values()].filter(x=>x.scope===s&&x.data.attempt_id===id))
  };
}
export async function transaction(tables,write,work) {
  const db=await connect();
  if(!db){
    const action=async()=>{
      const maps=new Map(tables.map(t=>[t,write?new Map(memory.get(t)):memory.get(t)]));
      const ret=await work(memoryView(maps,write));
      if(write) for(const [t,m] of maps) memory.set(t,m);
      return ret;
    };
    const result=memoryQueue.then(action);memoryQueue=result.catch(()=>{});return result;
  }
  const tx=db.transaction(tables,write?'readwrite':'readonly');
  const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error??new Error('ABORTED'));});
  done.catch(()=>{});
  const table=t=>tx.objectStore(t);
  const view={
    get:(t,k)=>fromRequest(table(t).get(k)),
    put:(t,r)=>fromRequest(table(t).put(r)),
    del:(t,k)=>fromRequest(table(t).delete(k)),
    all:(t,s)=>fromRequest(s===undefined?table(t).getAll():table(t).index('scope').getAll(s)),
    prefix:(t,p)=>fromRequest(table(t).getAll(IDBKeyRange.bound(p,p+'\uffff'))),
    count:(t,s)=>fromRequest(table(t).index('scope').count(s)),
    scan:(t,s,visit,direction='next')=>new Promise((resolve,reject)=>{
      const cursor=table(t).index('scope').openCursor(s,direction);
      cursor.onerror=()=>reject(cursor.error);
      cursor.onsuccess=async()=>{
        const it=cursor.result;
        if(!it){resolve();return;}
        try{if(await visit(it.value)===false){resolve();return;}it.continue();}catch(e){reject(e);}
      };
    }),
    forAttempt:(s,id)=>fromRequest(table('events').index('attempt').getAll([s,id]))
  };
  try{const result=await work(view);await done;return result;}
  catch(error){try{tx.abort();}catch{} await done.catch(()=>{});if(error.name==='QuotaExceededError')signal('QUOTA_EXCEEDED');throw error;}
}
export const key=(scope,id)=>scope+'|'+id;
export const row=(scope,id,data)=>({key:key(scope,id),scope,id,data});
