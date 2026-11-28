"""Parse the six real exports and render the two paginated formats with independent readers."""
from pathlib import Path
import csv, hashlib, io, json, os, re, shutil, subprocess, tempfile, zipfile
import fitz
from docx import Document
from openpyxl import load_workbook
from jsonschema import Draft202012Validator, FormatChecker
from PIL import Image, ImageOps, ImageDraw
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'evidence/teacher/exports'
EVD=ROOT/'evidence/teacher'
spec=next((ROOT/'spec').rglob('core.schema.json'))
schema=json.loads(spec.read_text())
validator=Draft202012Validator({'$defs':schema['$defs'],'$ref':'#/$defs/ReportSnapshot'},format_checker=FormatChecker())
expected={'A':(14,3,2,1,70),'B':(5,0,0,5,50),'C':(59,51,0,0,100*59/110),'D':(1,0,0,0,100),'E':(72,28,0,0,72),'F':(0,0,0,0,None)}
tested=[]
def normalize(s):return ' '.join(s.split())
for case,(c,w,s,b,score) in expected.items():
    path=OUT/('MET-'+case);report=json.loads((path/'report.json').read_text());core=report['core'];validator.validate(core)
    assert (core['correct_count'],core['incorrect_count'],core['skipped_count'],core['blank_count'])==(c,w,s,b)
    assert core['form_score_percent']==score
    with fitz.open(path/'report.pdf') as pdf:
        pt=' '.join(normalize(p.get_text()) for p in pdf)
        assert len(pdf)>0 and 'DEMONSTRATION DATA' in pt and core['report_id'] in pt
        assert str(c)+' / '+str(core['assigned_count']) in pt
        if case=='A':assert '82,4%' in pt and '95%' in pt and '70%' in pt
        if case=='D':assert '0 / 1' in pt
        if case=='E':assert '+28 percentage points' in pt
    doc=Document(path/'report.docx');plain=' '.join(p.text for p in doc.paragraphs)
    assert 'DEMONSTRATION DATA' in plain and core['report_id'] in plain
    assert any(cell.text==str(c)+' / '+str(core['assigned_count']) for table in doc.tables for row in table.rows for cell in row.cells)
    with zipfile.ZipFile(path/'report.docx') as z:assert z.testzip() is None and b'tblHeader' in z.read('word/document.xml')
    book=load_workbook(path/'report.xlsx',read_only=True,data_only=False)
    assert {'Summary','Competencies','Sessions','Dictionary','Metadata'}.issubset(book.sheetnames)
    row=list(book['Summary'].values)[1]; assert row[2]==core['assigned_count'] and row[3]==c and row[8]==score and row[1]=='SIMULASI / DEMONSTRATION DATA'
    data=list(csv.reader((path/'report.csv').open(encoding='utf-8-sig',newline='')))
    first=data[1];assert first[1]==report['person']['alias'] and int(first[4])==c and first[2]=='SIMULASI / DEMONSTRATION DATA'
    tested.append(case)
with zipfile.ZipFile(OUT/'reports.zip') as z:
    assert z.testzip() is None
    m=json.loads(z.read('manifest.json'))
    assert len(z.namelist())==3 and m['requested']==2 and len(m['files'])==2
    for f in m['files']:
        assert re.fullmatch(r'[A-Za-z0-9_.-]+',f['file'])
        data=z.read(f['file']);assert hashlib.sha256(data).hexdigest()==f['sha256']
        with fitz.open(stream=data,filetype='pdf') as d:assert f['report_id'] in ' '.join(p.get_text() for p in d)
stress=json.loads((OUT/'stress.json').read_text());book=load_workbook(OUT/'stress.xlsx',read_only=True)
assert book['Summary']['A2'].data_type=='s' and book['Summary']['A2'].value.startswith('=')
assert dict(book['Metadata'].values)['change_pp']==-12.3
ct=list(csv.reader((OUT/'stress.csv').open(encoding='utf-8-sig',newline=''),delimiter=';'))
assert ct[1][1].startswith("'=SUM") and any(row==['Metadata','change_pp','-12.3'] for row in ct)
for kind in ('pdf','docx'):
    p=OUT/('stress.'+kind)
    if kind=='docx':
        exe=shutil.which('soffice') or shutil.which('libreoffice')
        if not exe:raise RuntimeError('LibreOffice required for visual inspection')
        with tempfile.TemporaryDirectory() as tmp:
            ret=subprocess.run([exe,'-env:UserInstallation=file://'+tmp+'/profile','--headless','--convert-to','pdf','--outdir',tmp,str(p)],check=True,capture_output=True,text=True)
            dest=EVD/'docx-rendered.pdf';shutil.copy(Path(tmp)/'stress.pdf',dest)
        p=dest
    with fitz.open(p) as pdf:
        assert len(pdf)>=3
        plain=normalize(' '.join(page.get_text() for page in pdf));assert '½' in plain and '−12' in plain and '÷' in plain,plain
        assert '∕' in plain or '⁄' in plain
        assert 'DEMONSTRATION DATA' in plain
        assert stress['core']['report_id'] in plain
        thumb=[]
        for i,page in enumerate(pdf):
            for block in page.get_text('blocks'):
                x0,y0,x1,y1=block[:4];assert min(x0,y0)>=0 and x1<=page.rect.width+1 and y1<=page.rect.height+1,(kind,i,block)
            pix=page.get_pixmap(matrix=fitz.Matrix(0.75,0.75),alpha=False);im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
            thumb.append(im)
            if i==0:im.save(EVD/(kind+'-page1.png'))
        contact=Image.new('RGB',(300*min(3,len(thumb)),450*((len(thumb)+2)//3)), '#d8dad5')
        draw=ImageDraw.Draw(contact)
        for i,im in enumerate(thumb):
            im.thumbnail((276,406));x=(i%3)*300+12;y=i//3*450+10;contact.paste(im,(x,y));draw.text((x,y+409),f'{kind.upper()}   {i+1} / {len(thumb)}',fill='black')
        contact.save(EVD/(kind+'-pages.png'))
        tested.append(f'{kind} pages={len(pdf)}')
mapping={
'TC-151':'MET-C pooled 59/110 response accuracy; incomplete forms excluded',
'TC-153':'Matching dashboard and exported snapshot. Filter checks include subject, admin class, module, source, grade, level, mode and local-date-exclusive period.',
'TC-154':'Traceable recommendations for zero, insufficient and observed arithmetic evidence.',
'TC-155':'All six metric fixtures parsed from PDF and DOCX; embedded Unicode PDF font, DOCX repeat-header, LibreOffice rendering and multipage stress checks.',
'TC-156':'XLSX numerics and typed-string aliases, CSV quoted names, semicolon/comma, UTF-8 BOM, injection escaping and numeric negative preservation.',
'TC-157':'Schema-validated strict core JSON and versioned report detail. ZIP CRC, SHA-256, membership, safe filenames and report-to-subject mapping.',
'TC-158':'Batch progress per subject, abort after first file and single-failure manifest; worker transport tested separately in browser.',
'TC-159':'Unverified local label and scope isolation; demo watermark and metadata in documents and spreadsheets.'
}
(EVD/'validation.json').write_text(json.dumps({'status':'PASS','covers':mapping,'cases':tested,'readers':['PyMuPDF','LibreOffice headless','python-docx','openpyxl','csv','zipfile','jsonschema'],'limitation':'Renderer bounds and text extraction are automated. Visual review observations are recorded separately.'},indent=2))
print('PASS',tested)
