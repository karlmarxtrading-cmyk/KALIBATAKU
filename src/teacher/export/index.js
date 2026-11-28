import {fileStem} from '../document.js';
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export const mime={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',json:'application/json',csv:'text/csv;charset=utf-8',zip:'application/zip'};
export async function encode(s,format,options={}) {
  if(format==='json')return new TextEncoder().encode(JSON.stringify(s,null,2)+'\n');
  const load={pdf:()=>import('./pdf.js'),docx:()=>import('./docx.js'),xlsx:()=>import('./xlsx.js'),csv:()=>import('./csv.js')};
  if(!Object.hasOwn(load,format))throw new Error('FORMAT');
  return (await load[format]()).make(s,options);
}
export async function batch(reports,options={}){
  const {zip}=await import('./zip.js'),parts=[],manifest={schema_version:'report-batch-1.0',requested:reports.length,files:[],errors:[],created_at:new Date().toISOString(),periods:[]};
  const unique=new Set();
  for(const [i,s] of reports.entries()){
    if(options.signal?.aborted)throw new DOMException('Cancelled','AbortError');
    const file=fileStem(s)+'.pdf';
    try{if(unique.has(file))throw new Error('DUPLICATE_FILENAME');
      const data=await encode(s,'pdf',options);const hash=await sha(data);unique.add(file);parts.push([file,data]);manifest.files.push({file,report_id:s.core.report_id,profile_id:s.person.id,sha256:hash,bytes:data.byteLength});}
    catch(error){manifest.errors.push({profile_id:s.person.id,reason:error.message});}
    manifest.periods.push([s.person.id,s.core.period_start_utc,s.core.period_end_exclusive_utc]);
    options.onProgress?.(i+1,reports.length);await new Promise(r=>setTimeout(r,0));
  }
  if(options.signal?.aborted)throw new DOMException('Cancelled','AbortError');
  parts.push(['manifest.json',JSON.stringify(manifest,null,2)]);return {data:zip(parts),manifest};
}
