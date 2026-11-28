import {zip} from './zip.js';
import {xml,relations,contentTypes,relBase} from './office.js';
import {sheets} from '../document.js';
const SS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function sheet(rows){
  return '<worksheet xmlns="'+SS+'"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="20" width="23" customWidth="1"/></cols><sheetData>'+rows.map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>{const ref=String.fromCharCode(65+j)+(i+1);if(v==null)return '<c r="'+ref+'"/>';return typeof v==='number'?'<c r="'+ref+'"><v>'+v+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>';}).join('')+'</row>').join('')+'</sheetData></worksheet>';
}
export function make(s){
  const list=sheets(s),entries=[['xl/workbook.xml','spreadsheetml.sheet.main+xml'],...list.map((_,i)=>['xl/worksheets/sheet'+(i+1)+'.xml','spreadsheetml.worksheet+xml'])];
  return zip([['[Content_Types].xml',contentTypes(entries)],['_rels/.rels',relations([['book','officeDocument','xl/workbook.xml']])],
    ['xl/workbook.xml','<workbook xmlns="'+SS+'" xmlns:r="'+relBase.slice(0,-1)+'"><sheets>'+list.map(([k],i)=>'<sheet name="'+k+'" sheetId="'+(i+1)+'" r:id="s'+(i+1)+'"/>').join('')+'</sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels',relations(list.map((_,i)=>['s'+(i+1),'worksheet','worksheets/sheet'+(i+1)+'.xml']))],
    ...list.map(([,r],i)=>['xl/worksheets/sheet'+(i+1)+'.xml',sheet(r)])]);
}
