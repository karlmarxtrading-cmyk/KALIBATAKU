import {tokens,linear,speech} from './model.mjs';
// The native typesetter (typeset.mjs + glyphs.mjs, ~5 KB gzip) is loaded on first use.
// While it loads the grouped linear text is visible; if it cannot load, the linear text
// stays with a retry action. Every state keeps the same accessible name and data-linear.
let engine,observer,sizeObserver,loadAttempts=0;
const LOAD_TIMEOUT=6000;
function sizeMath(el){
 const overflow=el.scrollWidth>el.clientWidth+2;
 if(overflow){el.tabIndex=0;el.title=el.dataset.mathLang==='en'?'Scroll horizontally to read the entire expression':'Gulir mendatar untuk membaca seluruh rumus';}
 else{el.removeAttribute('tabindex');el.removeAttribute('title');}
}
const renderJobs=new WeakMap();
function load(){
 if(engine)return engine;
 const url=new URL('./typeset.mjs',import.meta.url);if(loadAttempts)url.searchParams.set('retry',String(loadAttempts));loadAttempts++;
 engine=import(url.href).then(m=>{if(typeof m.render!=='function')throw Error('MATH_LOAD');return m;}).catch(e=>{engine=null;throw e;});
 return engine;
}
function cleanup(root){if(root.nodeType!==1)return;const blocks=root.matches('[data-math]')?[root]:root.querySelectorAll('[data-math]');for(const b of blocks){if(b.isConnected)continue;renderJobs.delete(b);sizeObserver?.unobserve(b);}}
export function clearMath(root){if(!root)return;for(const b of root.querySelectorAll('[data-math]')){renderJobs.delete(b);sizeObserver?.unobserve(b);}}
function observe(){if(observer||typeof MutationObserver!=='function')return;observer=new MutationObserver(rows=>{for(const row of rows){for(const n of row.removedNodes)cleanup(n);}});observer.observe(document.body,{subtree:true,childList:true});}
export function formula(ast,lang='id',opts={}){
 const el=document.createElement('span');el.className='math-formula';el.dataset.math='pending';el.dataset.mathLang=lang;el.setAttribute('role','math');
 let parts;try{parts=tokens(ast,lang,opts);}catch{el.dataset.math='invalid';el.textContent=lang==='id'?'Rumus tidak tersedia':'Expression unavailable';return el;}
 const text=linear(parts);
 el.setAttribute('aria-label',speech(parts,lang));el.dataset.linear=text;
 const surface=document.createElement('span');surface.className='math-surface';surface.setAttribute('aria-hidden','true');surface.textContent=text;el.append(surface);
 const run=async()=>{
  const ticket={};renderJobs.set(el,ticket);let timeout;
  try{
   const work=async()=>{const m=await load();if(renderJobs.get(el)!==ticket)return;const rendered=m.render(parts);const copy=document.createElement('span');copy.className='math-text';copy.textContent=text;surface.replaceChildren(...rendered,copy);el.dataset.math='svg';sizeMath(el);if(typeof ResizeObserver==='function'){sizeObserver??=new ResizeObserver(entries=>{for(const {target} of entries)sizeMath(target);});sizeObserver.observe(el);}};
   await Promise.race([work(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('MATH_TIMEOUT')),LOAD_TIMEOUT);})]);
  }catch{
   if(renderJobs.get(el)!==ticket)return;renderJobs.delete(el);el.dataset.math='fallback';surface.textContent=text;
   const note=document.createElement('span');note.className='math-warning';note.setAttribute('role','group');
   note.textContent=lang==='id'?'Tampilan rumus sederhana. ':'Plain formula view. ';
   const retry=document.createElement('button');retry.type='button';retry.className='kp-btn light small';retry.textContent=lang==='id'?'Coba tampilkan rumus':'Retry math display';
   retry.onclick=()=>{note.remove();el.dataset.math='pending';el.mathReady=run();};note.append(retry);el.after(note);
   if(!note.isConnected)queueMicrotask(()=>{if(el.isConnected&&!note.isConnected)el.after(note);});
  }
  finally{clearTimeout(timeout);}
 };
 observe();el.mathReady=run();return el;
}
// Only numeric literals in trusted curricular prose are upgraded. Everything else remains a text node.
export function mathProse(text,lang){
 const span=document.createElement('span');let pos=0;
 for(const m of String(text||'').matchAll(/(?<![\w/])([−-]?\d{1,70})[⁄/](\d{1,70})(?![\w/])/gu)){
  span.append(document.createTextNode(text.slice(pos,m.index)));const n=m[1].replace('−','-'),d=m[2];
  if(BigInt(d)>0n)span.append(formula({kind:'rational',numerator:n,denominator:d,display:{kind:'fraction',numerator:n,denominator:d}},lang));else span.append(document.createTextNode(m[0]));pos=m.index+m[0].length;
 }
 span.append(document.createTextNode((text||'').slice(pos)));return span;
}
