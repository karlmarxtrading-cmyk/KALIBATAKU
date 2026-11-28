const enc=new TextEncoder();
const table=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(b){let c=0xffffffff;for(const n of b)c=table[(c^n)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function header(length,fields){const a=new Uint8Array(length),d=new DataView(a.buffer);for(const [at,n,wide] of fields)wide?d.setUint32(at,n,true):d.setUint16(at,n,true);return a;}
export function bytes(v){return typeof v==='string'?enc.encode(v):v;}
export function join(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let pos=0;for(const p of parts){out.set(p,pos);pos+=p.length;}return out;}
export function zip(files){
  const data=[],central=[];let offset=0,cdSize=0;
  for(const [file,raw] of files){const name=enc.encode(file),b=bytes(raw),n=b.length,crc=crc32(b);
    const local=header(30,[[0,0x04034b50,1],[4,20],[6,2048],[12,33],[14,crc,1],[18,n,1],[22,n,1],[26,name.length]]);
    const dir=header(46,[[0,0x02014b50,1],[4,20],[6,20],[8,2048],[14,33],[16,crc,1],[20,n,1],[24,n,1],[28,name.length],[42,offset,1]]);
    data.push(local,name,b);central.push(dir,name);offset+=local.length+name.length+n;cdSize+=dir.length+name.length;
  }
  if(offset+cdSize>0xffffffff||files.length>65535)throw new Error('ZIP_LIMIT');
  return join([...data,...central,header(22,[[0,0x06054b50,1],[8,files.length],[10,files.length],[12,cdSize,1],[16,offset,1]])]);
}
