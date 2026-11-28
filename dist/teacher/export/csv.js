import {sheets} from '../document.js';
export function make(s,options={}) {
  const delimiter=options.delimiter===';'?';':',';
  const field=v=>{if(typeof v==='number')return String(v);if(v==null)return '';let t=String(v);
    if(/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(t))t="'"+t;
    return '"'+t.replaceAll('"','""')+'"';};
  const all=sheets(s).flatMap(([name,rows])=>rows.map(row=>[name,...row]));
  return new TextEncoder().encode('\uFEFF'+all.map(row=>row.map(field).join(delimiter)).join('\r\n')+'\r\n');
}
