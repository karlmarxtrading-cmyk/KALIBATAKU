import {documentModel} from '../document.js';
import {bytes,join} from './zip.js';
let resources;
async function fontAssets() {
  if(!resources) resources=Promise.all(['DejaVuSans.ttf','metrics.json'].map(async file=>{
    const r=await fetch(new URL('../font/'+file,import.meta.url));if(!r.ok)throw new Error('FONT_LOAD');
    return file.endsWith('json')?r.json():new Uint8Array(await r.arrayBuffer());
  })).catch(e=>{resources=null;throw e;});
  return resources;
}
export async function make(s,options={}) {
  const [font,map]=options.font||await fontAssets();
  const missing=new Set(),used=new Map();
  const glyph=c=>{const cp=c.codePointAt(0);if(!map[cp])missing.add(cp);return map[cp]||map[9633];};
  const measure=(txt,size)=>Array.from(txt,c=>glyph(c)[1]*size/1000).reduce((a,b)=>a+b,0);
  function wrap(txt,width,size){let lines=[],line='';for(const word of String(txt).split(/\s+/)) {
    if(line&&measure(line+' '+word,size)<=width){line+=' '+word;continue;}
    if(line){lines.push(line);line='';}
    for(const c of word){if(line&&measure(line+c,size)>width){lines.push(line);line='';}line+=c;}
  }lines.push(line);return lines;}
  const hex=n=>n.toString(16).padStart(4,'0');
  const ink='0.12 0.18 0.15',green='0.12 0.30 0.24';
  const pages=[];let y=0;
  function text(x,y,txt,size,color=ink){let encoded='';for(const ch of txt){
    const [gid,width]=glyph(ch);if(!used.has(gid))used.set(gid,{width,char:map[ch.codePointAt(0)]?ch:'□'});encoded+=hex(gid);}
    pages.at(-1).push('BT /F '+size+' Tf '+color+' rg 1 0 0 1 '+x.toFixed(2)+' '+y.toFixed(2)+' Tm <'+encoded+'> Tj ET');}
  function page(){pages.push([]);text(44,807,'KALIBATAKU    /    MENTAL MATH',9,green);pages.at(-1).push('0.72 0.80 0.75 RG 44 795 m 551 795 l S');y=770;}
  function space(h){if(y-h<48)page();}
  function para(val,size=11,lead=16,color=ink){for(const ln of wrap(val,499,size)){space(lead);text(48,y,ln,size,color);y-=lead;}y-=5;}
  page();const doc=documentModel(s);
  para(doc.title,21,27,green);
  for(const b of doc.blocks){
    if(b.kind==='h'){space(61);y-=8;para(b.text,14,19,green);continue;}
    if(b.kind==='p'){para(b.text);continue;}
    if(b.kind==='math'){
      // Selectable vector text, with one indivisible layout box per fraction.
      let x=48;space(36);text(x,y,b.label+' · ',11);x+=measure(b.label+' · ',11);
      for(const t of b.math){
        const f=t.type==='fraction',width=f?Math.max(measure(t.n,10),measure(t.d,10))+8:measure(t.text,12)+4;
        if(x+width>545){y-=33;space(36);x=48;}
        if(f){text(x+(width-measure(t.n,10))/2,y+5,t.n,10);text(x+(width-measure(t.d,10))/2,y-8,t.d,10);
          pages.at(-1).push('0.12 0.18 0.15 RG '+x.toFixed(2)+' '+(y+2).toFixed(2)+' m '+(x+width).toFixed(2)+' '+(y+2).toFixed(2)+' l S');}
        else text(x,y,t.text,12);
        x+=width;
      }
      y-=30;continue;
    }
    const widths=b.widths.map(w=>w*499);
    function row(cells,header=false){const lines=cells.map((v,i)=>wrap(v,widths[i]-12,10.5));const height=14*Math.max(...lines.map(a=>a.length))+11;
      if(y-height<47){page();if(!header)row(b.headers,true);}
      if(header)pages.at(-1).push('0.89 0.93 0.90 rg 48 '+(y-height+5).toFixed(2)+' 499 '+height+' re f');
      let x=48;for(let i=0;i<cells.length;i++){lines[i].forEach((ln,j)=>text(x+5,y-8-14*j,ln,10.5));x+=widths[i];}
      y-=height;pages.at(-1).push('0.84 0.88 0.85 RG 44 '+(y+5)+' m 551 '+(y+5)+' l S');}
    row(b.headers,true);b.rows.forEach(r=>row(r));y-=10;
  }
  for(let i=0;i<pages.length;i++){
    const tail=pages[i];const label=(i+1)+' / '+pages.length;let encoded='';
    for(const ch of label){const [gid,width]=glyph(ch);if(!used.has(gid))used.set(gid,{width,char:ch});encoded+=hex(gid);}
    tail.push('BT /F 9 Tf '+green+' rg 1 0 0 1 510 28 Tm <'+encoded+'> Tj ET');
  }
  if(missing.size)throw new Error('FONT_COVERAGE '+[...missing].map(n=>'U+'+n.toString(16)).join(' '));
  const stream=(props,raw)=>join([bytes('<< '+props+' /Length '+raw.length+' >>\nstream\n'),raw,bytes('\nendstream')]);
  let fontData=font,flate='';
  if(typeof CompressionStream==='function'){fontData=new Uint8Array(await new Response(new Blob([font]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());flate='/Filter /FlateDecode ';}
  const objects=[null,null],add=v=>(objects.push(typeof v==='string'?bytes(v):v),objects.length);
  const fontFile=add(stream(flate+'/Length1 '+font.length,fontData));
  const desc=add('<< /Type /FontDescriptor /FontName /DejaVuSans /Flags 32 /FontBBox [-1021 -463 1793 1233] /ItalicAngle 0 /Ascent 928 /Descent -236 /CapHeight 729 /StemV 80 /FontFile2 '+fontFile+' 0 R >>');
  const entries=[...used].sort(([a],[b])=>a-b);
  const widths=entries.map(([g,m])=>g+' ['+m.width+']').join(' ');
  const cid=add('<< /Type /Font /Subtype /CIDFontType2 /BaseFont /DejaVuSans /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor '+desc+' 0 R /CIDToGIDMap /Identity /W ['+widths+'] >>');
  const mappings=entries.map(([g,m])=>'<'+hex(g)+'> <'+m.char.split('').map(c=>hex(c.charCodeAt(0))).join('')+'>');
  const chunks=[];for(let i=0;i<mappings.length;i+=90){const chunk=mappings.slice(i,i+90);chunks.push(chunk.length+' beginbfchar\n'+chunk.join('\n')+'\nendbfchar');}
  const cmap=add(stream('',bytes('/CIDInit /ProcSet findresource begin\n12 dict begin begincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Kali-Unicode def /CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n'+chunks.join('\n')+'\nendcmap CMapName currentdict /CMap defineresource pop end end')));
  const f=add('<< /Type /Font /Subtype /Type0 /BaseFont /DejaVuSans /Encoding /Identity-H /DescendantFonts ['+cid+' 0 R] /ToUnicode '+cmap+' 0 R >>');
  const ids=pages.map(contents=>{const c=add(stream('',bytes(contents.join('\n'))));return add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F '+f+' 0 R >> >> /Contents '+c+' 0 R >>');});
  objects[0]=bytes('<< /Type /Catalog /Pages 2 0 R >>');objects[1]=bytes('<< /Type /Pages /Count '+ids.length+' /Kids ['+ids.map(n=>n+' 0 R').join(' ')+'] >>');
  const parts=[bytes('%PDF-1.7\n')],offsets=[0];let size=parts[0].length;
  objects.forEach((o,i)=>{offsets.push(size);const obj=join([bytes((i+1)+' 0 obj\n'),o,bytes('\nendobj\n')]);parts.push(obj);size+=obj.length;});
  parts.push(bytes('xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+size+'\n%%EOF\n'));
  return join(parts);
}
