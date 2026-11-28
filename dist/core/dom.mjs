export function element(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key,value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2),value);
    else if (key === 'dataset') Object.assign(node.dataset,value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child !== null && child !== undefined && child !== false) node.append(child);
  }
  return node;
}
const icons={
  arrow:'M4 12h15m-6-6 6 6-6 6', back:'m14 6-6 6 6 6',next:'m9 6 6 6-6 6',down:'m6 9 6 6 6-6',
  book:'M3 5c3-1.6 6.2-1.5 9 1 2.8-2.5 6-2.6 9-1v13c-3-1.5-6-1-9 1.5C9 17 6 16.5 3 18z M12 6v13',
  graph:'M3 20h18M5 15l4-5 4 2 6-7 M15 5h4v4',
  offline:'M7 18H6a4 4 0 0 1-1-7.9A7 7 0 0 1 18.5 8a5.1 5.1 0 0 1 .5 10h-1 M12 11v9m-3-3 3 3 3-3',
  settings:'M4 7h7m4 0h5M4 17h3m4 0h9 M12.8 4.5a2.5 2.5 0 1 0 .2 5 2.5 2.5 0 0 0-.2-5z M9 14.5a2.5 2.5 0 1 0 .1 5 2.5 2.5 0 0 0-.1-5z',
  user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 1 1 16 0',
  globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M3 12h18 M12 3c-5.2 5-5.2 13 0 18 5.2-5 5.2-13 0-18z',
  clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M12 6v6l4 2',
  layers:'m3 8 9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5',
  menu:'M4 6h16M4 12h16M4 18h16',home:'m3 11 9-8 9 8 M6 10v10h12V10',
  school:'m2 9 10-5 10 5-10 5z M6 12v4c3 3 9 3 12 0v-4',
  check:'m4 12 5 5L20 6',lock:'M6 10h12v11H6z M8 10V7a4 4 0 0 1 8 0v3',
  sun:'M12 8a4 4 0 1 0 .1 8A4 4 0 0 0 12 8z M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  play:'m8 4 12 8-12 8z',list:'M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1',
  help:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M9.5 8.7c.3-3.3 5.7-3 5.5.2 0 2-3 2.4-3 4.6 M12 16.8v.2',
  save:'M4 4h13l3 3v13H4z M8 4v6h8V4 M8 20v-6h8v6',
  pencil:'m4 16 11-11 4 4L8 20l-5 1z',report:'M4 3h11l4 4v14H4z M8 11h7m-7 4h7',leaf:'M20 3c-9 0-15 3-15 10a6 6 0 0 0 6 6c7 0 9-8 9-16z M4 21l11-12'
};
export function icon(name, size=20) {
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  for(const [k,v] of Object.entries({viewBox:'0 0 24 24',width:size,height:size,fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'})) svg.setAttribute(k,v);
  const path=document.createElementNS(ns,'path');path.setAttribute('d',icons[name]||icons.next);svg.append(path);return svg;
}
export const link=(route,content,className='',extras={})=>element('a',{href:'#/'+route,class:className,...extras},content);
export const heading=(title,sub=null)=>element('div',{class:'page-heading'},element('h1',{},title),sub&&element('p',{},sub));
export const routeTo=(name,values={})=>{const query=new URLSearchParams();for(const [key,value] of Object.entries(values))if(value!==undefined && value!==null && value!=='')query.set(key,String(value));return name+(query.size?'?'+query:'');};
export function labelled(text,control){control.setAttribute('aria-label',text);return element('label',{class:'field'},element('span',{},text),control);}
export function select(options,selected,onChange) {
  const el=element('select',{onchange:onChange},options.map(([value,label])=>element('option',{value},label)));
  el.value=String(selected);return el;
}
