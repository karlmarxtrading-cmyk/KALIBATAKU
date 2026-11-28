// Minimal ZIP container for profile archives (TECH-01). Deflate-raw through the
// platform Compression Streams API, CRC-32 per entry, no ZIP64, no encryption.
// The reader works on Blob slices, enforces a decompressed-size limit per entry while
// streaming (zip-bomb guard) and rejects unknown, duplicate or unsafe entry names.
import {fail,invariant} from './common.js';

const table=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
export function crc32(bytes,crc=0){let c=(crc^0xffffffff)>>>0;for(let i=0;i<bytes.length;i++)c=table[(c^bytes[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
const hasStreams=()=>typeof CompressionStream==='function'&&typeof DecompressionStream==='function';

async function collect(stream,limit=Infinity){
  const reader=stream.getReader(),chunks=[];let n=0;
  for(;;){
    const {done,value}=await reader.read();if(done)break;
    n+=value.byteLength;if(n>limit){await reader.cancel().catch(()=>{});fail('ARCHIVE_TOO_LARGE');}
    chunks.push(value);
  }
  const out=new Uint8Array(n);let o=0;for(const c of chunks){out.set(c,o);o+=c.byteLength;}
  return out;
}
async function deflate(bytes){
  if(!hasStreams())return {method:0,data:bytes};
  const data=await collect(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw')));
  return data.length<bytes.length?{method:8,data}:{method:0,data:bytes};
}
function header(size,fields){const b=new Uint8Array(size),v=new DataView(b.buffer);for(const [o,val,wide] of fields)wide?v.setUint32(o,val>>>0,true):v.setUint16(o,val,true);return b;}
const enc=new TextEncoder();
// files: [{name, bytes:Uint8Array}] → Blob (application/zip)
export async function writeZip(files,{signal,onEntry}={}){
  const parts=[],central=[];let offset=0;const time=0,dateBits=(2026-1980)<<9|1<<5|1;
  for(const f of files){
    signal?.throwIfAborted();
    const name=enc.encode(f.name),crc=crc32(f.bytes),{method,data}=await deflate(f.bytes);
    const local=header(30,[[0,0x04034b50,1],[4,20],[6,2048],[8,method],[10,time],[12,dateBits],[14,crc,1],[18,data.length,1],[22,f.bytes.length,1],[26,name.length]]);
    const dir=header(46,[[0,0x02014b50,1],[4,20],[6,20],[8,2048],[10,method],[12,time],[14,dateBits],[16,crc,1],[20,data.length,1],[24,f.bytes.length,1],[28,name.length],[42,offset,1]]);
    parts.push(local,name,data);central.push(dir,name);offset+=30+name.length+data.length;
    invariant(offset<0xfffffff0,'ARCHIVE_TOO_LARGE');onEntry?.(f.name);
  }
  const size=central.reduce((s,b)=>s+b.length,0);
  const end=header(22,[[0,0x06054b50,1],[8,files.length],[10,files.length],[12,size,1],[16,offset,1]]);
  return new Blob([...parts,...central,end],{type:'application/zip'});
}
async function bytesOf(blob,start,end){return new Uint8Array(await blob.slice(start,end).arrayBuffer());}
export async function isZip(blob){
  if(!(blob instanceof Blob)||blob.size<22)return false;
  const b=await bytesOf(blob,0,4);return b[0]===0x50&&b[1]===0x4b&&b[2]===3&&b[3]===4;
}
// Returns Map(name → entry). `allowed(name)` must accept every entry.
export async function readZipIndex(blob,{allowed,maxEntries=5000}){
  invariant(blob.size>=22,'INVALID_ARCHIVE');
  const tailStart=Math.max(0,blob.size-65557),tail=await bytesOf(blob,tailStart,blob.size),tv=new DataView(tail.buffer);
  let eocd=-1;for(let i=tail.length-22;i>=0;i--)if(tv.getUint32(i,true)===0x06054b50){eocd=i;break;}
  invariant(eocd>=0,'INVALID_ARCHIVE');
  const count=tv.getUint16(eocd+10,true),cdSize=tv.getUint32(eocd+12,true),cdOffset=tv.getUint32(eocd+16,true);
  invariant(count>0&&count<=maxEntries&&cdOffset+cdSize<=blob.size,'INVALID_ARCHIVE');
  const cd=await bytesOf(blob,cdOffset,cdOffset+cdSize),v=new DataView(cd.buffer),dec=new TextDecoder('utf-8',{fatal:true});
  const entries=new Map();let p=0;
  for(let i=0;i<count;i++){
    invariant(p+46<=cd.length&&v.getUint32(p,true)===0x02014b50,'INVALID_ARCHIVE');
    const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),crc=v.getUint32(p+16,true),csize=v.getUint32(p+20,true),size=v.getUint32(p+24,true);
    const nlen=v.getUint16(p+28,true),xlen=v.getUint16(p+30,true),clen=v.getUint16(p+32,true),local=v.getUint32(p+42,true);
    const name=dec.decode(cd.subarray(p+46,p+46+nlen));
    invariant(!(flags&1)&&[0,8].includes(method)&&allowed(name)&&!entries.has(name)&&local+30<=blob.size,'INVALID_ARCHIVE');
    entries.set(name,{name,method,crc,csize,size,local});p+=46+nlen+xlen+clen;
  }
  return entries;
}
export async function readEntry(blob,entry,{limit,signal}){
  signal?.throwIfAborted();
  // TEK-02: decide from the central directory before any body byte is read. A STORED
  // entry is copied as-is, so its stored and declared sizes must agree and both must
  // fit the limit; a DEFLATE entry is bounded while streaming below.
  invariant(Number.isSafeInteger(entry.size)&&Number.isSafeInteger(entry.csize)&&entry.size>=0&&entry.csize>=0,'INVALID_ARCHIVE');
  invariant(entry.size<=limit,'ARCHIVE_TOO_LARGE');
  if(entry.method===0){invariant(entry.csize===entry.size,'INVALID_ARCHIVE');invariant(entry.csize<=limit,'ARCHIVE_TOO_LARGE');}
  const h=await bytesOf(blob,entry.local,entry.local+30),v=new DataView(h.buffer);
  invariant(v.getUint32(0,true)===0x04034b50,'INVALID_ARCHIVE');
  const start=entry.local+30+v.getUint16(26,true)+v.getUint16(28,true);
  invariant(start+entry.csize<=blob.size,'INVALID_ARCHIVE');
  const raw=blob.slice(start,start+entry.csize);let out;
  if(entry.method===0)out=new Uint8Array(await raw.arrayBuffer());
  else{invariant(hasStreams(),'ARCHIVE_UNSUPPORTED');try{out=await collect(raw.stream().pipeThrough(new DecompressionStream('deflate-raw')),limit);}catch(e){if(e.code==='ARCHIVE_TOO_LARGE')throw e;fail('CHECKSUM_MISMATCH');}}
  invariant(out.length===entry.size&&crc32(out)===entry.crc,'CHECKSUM_MISMATCH');
  return out;
}
