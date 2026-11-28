from pathlib import Path
import json,zipfile,tempfile,subprocess,hashlib
from xml.etree import ElementTree as ET
import fitz,openpyxl
root=Path(__file__).resolve().parents[2]
out=root/'evidence/v12/reports'
m={'m':'http://schemas.openxmlformats.org/officeDocument/2006/math'}
with zipfile.ZipFile(out/'pecahan.docx') as z:
    doc=ET.fromstring(z.read('word/document.xml'))
    fracs=[(n.findtext('m:num/m:r/m:t',namespaces=m),n.findtext('m:den/m:r/m:t',namespaces=m)) for n in doc.findall('.//m:f',m)]
assert fracs[:3]==[('11','12'),('10','12'),('7','4')],fracs
wb=openpyxl.load_workbook(out/'pecahan.xlsx',read_only=True);values=list(wb['Math'].values);assert list(values[1])[-4:]==['7','4','99','21/12'],values
csv=(out/'pecahan.csv').read_text(encoding='utf-8-sig');assert '11/12 + 10/12' in csv and '21/12' in csv
s=json.loads((out/'pecahan.json').read_bytes());assert s['firstDifficulty']['after_key'] and s['firstDifficulty']['key']=={'numerator':'7','denominator':'4'}
res={}
with tempfile.TemporaryDirectory() as t:
    subprocess.run(['soffice','-env:UserInstallation=file://'+t+'/profile','--headless','--convert-to','pdf','--outdir',t,str(out/'pecahan.docx')],capture_output=True,check=True)
    for name,p in [('pdf',out/'pecahan.pdf'),('docx',Path(t)/'pecahan.pdf')]:
        with fitz.open(p) as src:
            text=' '.join(page.get_text() for page in src);assert all(x in text for x in ['Kunci jawaban','99','21','11','10','12','7','4']),(name,text)
            words=[w for page in src for w in page.get_text('words')];assert all(w[0]>=0 and w[2]<=src[0].rect.width+1 for w in words)
            src[0].get_pixmap(matrix=fitz.Matrix(1.2,1.2)).save(out/f'pecahan-{name}.png')
            res[name]={'pages':len(src),'words':len(words),'reader':'PyMuPDF'+(' after LibreOffice' if name=='docx' else '')}
(out/'inspection.json').write_text(json.dumps({'status':'PASS','fractions_editable_omml':fracs,'rendered':res,'sheets':wb.sheetnames,'csv_raw':'21/12','sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.glob('pecahan.*')}},indent=2))
