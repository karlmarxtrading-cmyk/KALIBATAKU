import {element,link,icon,labelled,select} from '../core/dom.mjs';
export {element as h,link,icon,labelled,select};
export const button=(text,run,primary=false)=>element('button',{type:'button',class:primary?'primary':'',onclick:run},text);
export const box=(title,...children)=>element('section',{class:'tw-card'},element('h2',{},title),children);
export const chips=(items)=>element('div',{class:'tw-stats'},items.map(([label,value,detail])=>element('div',{},element('small',{},label),element('strong',{},String(value)),detail&&element('small',{},detail))));
export function table(head,rows) {
  return element('div',{class:'tw-scroll'},element('table',{class:'tw-table'},element('thead',{},element('tr',{},head.map(x=>element('th',{scope:'col'},x)))),
    element('tbody',{},rows.map(row=>element('tr',{},row.map(x=>element('td',{},x??'—')))))));
}
export function message(t,err){
  const code=String(err?.code||err?.message||err);
  if(code==='RECORD_CONFLICT')return t('Catatan ini telah direvisi. Muat ulang riwayat untuk melihat versi terbaru. Draf tetap tersedia.','This note was revised elsewhere. Reload the history to see the current revision. Your draft is kept.');
  if(code==='NOTE'||code==='NOTE_TARGET')return t('Periksa siswa dan isi catatan 1–2.000 karakter.','Check the learner and enter a note of 1–2,000 characters.');
  if(code==='ASSIGNMENT')return t('Pilih siswa dan paket yang tersedia, lalu coba simpan kembali.','Choose an available learner and package, then try saving again.');
  if(code.includes('BANK'))return t('Materi gagal dimuat. Periksa koneksi lalu coba lagi.','The material could not load. Check the connection and try again.');
  return t('Tindakan gagal. Periksa ruang penyimpanan dan coba lagi.','The action could not finish. Check device storage and retry.');
}
