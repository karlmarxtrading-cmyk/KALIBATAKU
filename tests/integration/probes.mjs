/* Read-only browser probes. For the release test origin only. */
export const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
export async function until(read, description, timeout=9000) {
  const end=performance.now()+timeout;
  let lastError;
  while(performance.now()<end) {
    try {const value=read(); if(value)return value;} catch(e){lastError=e;}
    await delay(40);
  }
  throw Error(description+(lastError?' ('+lastError.message+')':''));
}
export function visible(n) {
  if(!n||n.getClientRects().length===0||n.closest('[hidden],[inert]'))return false;
  for(let el=n.parentElement;el;el=el.parentElement)
    if(el.tagName==='DETAILS'&&!el.open && !el.querySelector(':scope > summary')?.contains(n))return false;
  return n.ownerDocument.defaultView.getComputedStyle(n).visibility!=='hidden';
}
export function controls(d) {
  return [...d.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button]')].filter(visible);
}
export function name(n) {
  const labelled=n.getAttribute('aria-labelledby');
  if(labelled)return labelled.split(/\s+/).map(id=>n.ownerDocument.getElementById(id)?.textContent||'').join(' ').trim();
  return String(n.getAttribute('aria-label')||[...(n.labels||[])].map(l=>l.innerText).join(' ')||n.innerText||n.getAttribute('alt')||n.getAttribute('title')||'').replace(/\s+/g,' ').trim();
}
export function describe(n) {return [n.tagName.toLowerCase(),name(n).slice(0,62),n.getAttribute('type')||''].join(' ').trim();}
export function button(d,rx) {return controls(d).find(n=>n.tagName==='BUTTON' && !n.matches(':disabled') && !n.closest('[aria-busy=true]') && rx.test(name(n)));}
export function geometry(w) {
  const d=w.document,root=d.documentElement, view=root.clientWidth;
  return {innerWidth:w.innerWidth, viewport:view, height:root.clientHeight,
    scroll:root.scrollWidth, lang:root.lang, theme:root.dataset.theme||null,
    h1:[...d.querySelectorAll('main h1')].filter(visible).map(n=>n.textContent.trim()),
    overflowElements: [...d.querySelectorAll('main *')].filter(n=>{
      if(!visible(n))return false; const rect=n.getBoundingClientRect();
      return (rect.right>view+2 || rect.left< -2) && rect.width>1 && !n.closest('.sr-only,.visually-hidden');
    }).slice(0,8).map(describe),
    domCount:d.getElementsByTagName('*').length,visibleControls:controls(d).length};
}
export function semantics(w) {
  const d=w.document, all=controls(d), ids=[...d.querySelectorAll('[id]')].map(x=>x.id);
  return {headings:[...d.querySelectorAll('h1,h2,h3')].filter(visible).map(n=>[n.tagName,n.innerText]),
    emptyNames:all.filter(x=>!name(x)).map(describe),
    duplicateIds:[...new Set(ids.filter((s,i)=>ids.indexOf(s)!==i))],
    skip:!!d.querySelector('a.skip-link'),
    viewport:d.querySelector('meta[name=viewport]')?.content,
    missingLabelRefs:[...d.querySelectorAll('[aria-labelledby],[aria-describedby]')].flatMap(n=>
      [n.getAttribute('aria-labelledby'),n.getAttribute('aria-describedby')].filter(Boolean)
        .flatMap(v=>v.split(/\s+/)).filter(id=>!d.getElementById(id))),
    landmarks: ['main','header','footer'].filter(tag=>!!d.querySelector(tag)),
    tiny:all.filter(n=>{const r=n.getBoundingClientRect();return r.width<24||r.height<24;}).map(n=>[describe(n),Math.round(n.getBoundingClientRect().width),Math.round(n.getBoundingClientRect().height)]),
    live:[...d.querySelectorAll('[role=status],[role=alert],[aria-live]')].filter(visible).map(x=>[x.getAttribute('role'),x.getAttribute('aria-live'),x.innerText.slice(0,80)])};
}
export function resources(w) {
  return w.performance.getEntriesByType('resource').filter(r=>r.name.startsWith('http')).map(r=>({
    path:new URL(r.name).pathname,type:r.initiatorType,bytes:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize,
    start:Math.round(r.startTime),duration:Math.round(r.duration),origin:new URL(r.name).origin
  }));
}
export async function resize(w,width,height) {
  for(let i=0;i<3;i++) {
    const dx=width-w.innerWidth,dy=height-w.innerHeight;
    if(!dx&&!dy)break;
    w.resizeBy(dx,dy);
    await delay(120);
  }
  return [w.innerWidth,w.innerHeight];
}
export async function route(w,base,path) {
  const expected=base+'#/'+path;
  const changed = w.location.href!==expected;
  const oldRoot=w.document.querySelector('main .app-view');
  const expectedRoute=path.split('?')[0]||'home';
  if(changed)w.location.href=expected;
  await until(()=>w.location.href===expected&&w.document.getElementById('app-header')?.children.length,'Application shell '+path);
  await until(()=>{
    const view=w.document.querySelector('main .app-view');
    return view && (!changed||view!==oldRoot) && view.dataset.route===expectedRoute &&
       !view.hasAttribute('aria-busy') && view.querySelector('h1');
  },'Rendered heading '+path);
  // A route paints its heading before some secondary modules finish.
  await delay(130);
  return w.document;
}
export async function chooseLang(w,lang) {
  if(w.document.documentElement.lang===lang)return;
  const b=w.document.querySelector('[data-action=language]');
  if(!b)throw Error('Language control missing');b.click();
  await until(()=>w.document.documentElement.lang===lang,'Language '+lang);
  await delay(80);
}
export async function chooseTheme(w,base,theme) {
  const d=await route(w,base,'settings');
  const field=await until(()=>d.querySelector('[name=theme]'),'Theme field');
  if(field.tagName==='SELECT'){
    field.value=theme;field.dispatchEvent(new w.Event('change',{bubbles:true}));
  } else {
    const option=d.querySelector('[name=theme][value="'+theme+'"]');if(!option)throw Error('Theme option '+theme);
    option.click();
  }
  await delay(100);
}

function cssColor(value) {
  if(!/^rgba?\(/.test(value))return null;
  const nums=value.match(/[\d.]+/g).map(Number);
  return nums.length<4?[...nums,1]:nums;
}
function over(a,b) {
  const alpha=a[3]+b[3]*(1-a[3]);
  return [...a.slice(0,3).map((v,i)=>(v*a[3]+b[i]*b[3]*(1-a[3]))/alpha),alpha];
}
function light(c) {
  const [r,g,b]=c.map(n=>n/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*r+.7152*g+.0722*b;
}
export function contrastProbe(w) {
  const measured=[],skipped=[];
  for(const node of w.document.querySelectorAll('body *')){
    const text=[...node.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').trim();
    if(!text||!visible(node)||node.matches('script,style,noscript,option')||node.namespaceURI.includes('svg'))continue;
    const cs=w.getComputedStyle(node);
    if(cs.opacity==='0'||cs.display==='none')continue;
    const fg=cssColor(cs.color);if(!fg)continue;
    let bg=[255,255,255,0],uncertain=false;
    for(let el=node;el;el=el.parentElement){
      const style=w.getComputedStyle(el);
      if(style.opacity!=='1'||style.backgroundImage!=='none')uncertain=true;
      const layer=cssColor(style.backgroundColor);
      if(layer&&layer[3]>0)bg=bg[3]===0?layer:over(bg,layer);
      if(bg[3]>.999)break;
    }
    if(uncertain||bg[3]<.999){skipped.push(describe(node));continue}
    const a=light(over(fg,bg)),b=light(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const threshold=parseFloat(cs.fontSize)>=24||(parseFloat(cs.fontWeight)>=700&&parseFloat(cs.fontSize)>=18.67)?3:4.5;
    measured.push({text:text.slice(0,62),ratio:Math.round(ratio*100)/100,threshold});
  }
  return {measured:measured.length,ambiguous_backgrounds:skipped.length,min_ratio:measured.length?Math.min(...measured.map(v=>v.ratio)):null,violations:measured.filter(v=>v.ratio+.005<v.threshold)};
}

export async function wideLayoutSnapshot(w,width,height,inspect=geometry) {
  // The compositor window may be smaller than a desktop monitor. For wider
  // targets, lay out the actual rendered markup using the distributed styles
  // in a sandboxed viewport. Script execution and navigation are disabled.
  const clone=w.document.documentElement.cloneNode(true);
  clone.querySelectorAll('script,noscript,base').forEach(n=>n.remove());
  const base=document.createElement('base');base.href=w.document.baseURI;
  clone.querySelector('head').prepend(base);
  const frame=document.createElement('iframe');
  frame.setAttribute('sandbox','allow-same-origin');
  Object.assign(frame.style,{position:'absolute',left:'-15000px',top:'0',width:width+'px',height:height+'px',border:'none'});
  const ready=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
  frame.srcdoc='<!doctype html>'+clone.outerHTML;document.body.append(frame);
  try{await ready;await frame.contentDocument.fonts.ready;await delay(90);return inspect(frame.contentWindow);}
  finally{frame.remove();}
}
