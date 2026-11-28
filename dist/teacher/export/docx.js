import {zip} from './zip.js';
import {xml,relations,contentTypes,relBase} from './office.js';
import {documentModel} from '../document.js';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function p(text,options=''){return '<w:p><w:pPr>'+options+'<w:spacing w:after="90"/></w:pPr><w:r><w:t xml:space="preserve">'+xml(text)+'</w:t></w:r></w:p>';}
function table(b){
  const width=9355;const row=(r,header)=>'<w:tr><w:trPr>'+(header?'<w:tblHeader/>':'')+'<w:cantSplit/></w:trPr>'+r.map((v,i)=>'<w:tc><w:tcPr><w:tcW w:type="dxa" w:w="'+Math.round(width*b.widths[i])+'"/>'+(header?'<w:shd w:fill="DDEAE4"/>':'')+'</w:tcPr>'+p(v)+'</w:tc>').join('')+'</w:tr>';
  return '<w:tbl><w:tblPr><w:tblW w:w="'+width+'" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:bottom w:val="single" w:sz="4" w:color="ADC5B9"/><w:insideH w:val="single" w:sz="3" w:color="DAE3DD"/></w:tblBorders><w:tblCellMar><w:top w:w="38" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="38" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+b.widths.map(w=>'<w:gridCol w:w="'+Math.round(width*w)+'"/>').join('')+'</w:tblGrid>'+row(b.headers,true)+b.rows.map(r=>row(r,false)).join('')+'</w:tbl>';
}
function equation(block){
  const run=value=>'<m:r><m:t>'+xml(value)+'</m:t></m:r>';
  const atoms=block.math.map(t=>t.type==='fraction'?'<m:f><m:num>'+run(t.n)+'</m:num><m:den>'+run(t.d)+'</m:den></m:f>':run(t.type==='op'?' '+t.text+' ':t.text));
  return '<w:p><w:r><w:t xml:space="preserve">'+xml(block.label+' · ')+'</w:t></w:r><m:oMath>'+atoms.join('')+'</m:oMath></w:p>';
}
export function make(s){
  const doc=documentModel(s);
  const body=p('KALIBATAKU  /  MENTAL MATH')+p(doc.title,'<w:pStyle w:val="Title"/>')+doc.blocks.map(b=>b.kind==='math'?equation(b):b.kind==='table'?table(b):p(b.text,b.kind==='h'?'<w:pStyle w:val="Heading1"/>':'')).join('')+
    '<w:sectPr><w:footerReference w:type="default" r:id="footer"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1020" w:right="1020" w:bottom="1020" w:left="1020" w:footer="620"/></w:sectPr>';
  const styles='<w:styles xmlns:w="'+W+'"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="DejaVu Sans" w:hAnsi="DejaVu Sans"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'+[['Title','Title',36],['Heading1','heading 1',26]].map(([id,label,size])=>'<w:style w:type="paragraph" w:styleId="'+id+'"><w:name w:val="'+label+'"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="220"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="214F40"/><w:sz w:val="'+size+'"/></w:rPr></w:style>').join('')+'</w:styles>';
  const entries=[['word/document.xml','wordprocessingml.document.main+xml'],['word/styles.xml','wordprocessingml.styles+xml'],['word/footer1.xml','wordprocessingml.footer+xml']];
  return zip([['[Content_Types].xml',contentTypes(entries)],['_rels/.rels',relations([['doc','officeDocument','word/document.xml']])],
    ['word/document.xml','<w:document xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="'+W+'" xmlns:r="'+relBase.slice(0,-1)+'"><w:body>'+body+'</w:body></w:document>'],['word/styles.xml',styles],
    ['word/_rels/document.xml.rels',relations([['styles','styles','styles.xml'],['footer','footer','footer1.xml']])],
    ['word/footer1.xml','<w:ftr xmlns:w="'+W+'"><w:p><w:r><w:t>KALIBATAKU     ·     </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>']]);
}
