from pathlib import Path
import json,csv,hashlib,ast,zipfile,gzip,io,collections,sys,xml.etree.ElementTree as ET
from PIL import Image
from pypdf import PdfReader
if len(sys.argv)!=2:raise SystemExit('Usage: python3 inspect_formats.py SOURCE_ROOT')
HERE=Path(__file__).resolve().parent
ROOT=Path(sys.argv[1]).expanduser().resolve()
INVENTORY=HERE.parent/'07_BUKTI/inventaris/FILE_INVENTORY_6074.csv'
OUTPUT=HERE/'format-inspection-rerun.json'
if not ROOT.is_dir():raise SystemExit('SOURCE_ROOT bukan direktori: '+str(ROOT))
if not INVENTORY.is_file():raise SystemExit('Inventaris audit tidak ditemukan: '+str(INVENTORY))
with INVENTORY.open(encoding='utf-8-sig',newline='') as f:rows=list(csv.DictReader(f))
summary=collections.Counter();issues=[];details=[]
for row in rows:
    p=ROOT/row['path'];ext=p.suffix.lower();status=''
    try:
        b=p.read_bytes()
        assert len(b)==int(row['bytes']) and hashlib.sha256(b).hexdigest()==row['sha256']
        if ext in ('.json','.webmanifest'):
            json.loads(b);status='JSON_PARSED'
        elif ext=='.csv':
            text=b.decode('utf-8-sig')
            try: dialect=csv.Sniffer().sniff(text.splitlines()[0],delimiters=',;\t')
            except csv.Error: dialect=csv.excel
            data=list(csv.reader(io.StringIO(text),dialect=dialect,strict=True))
            status='CSV_PARSED_MULTI_SECTION' if data and any(len(x)!=len(data[0]) for x in data) else 'CSV_PARSED'
        elif ext=='.py':
            ast.parse(b.decode('utf-8-sig'));status='PYTHON_PARSED'
        elif ext=='.svg':
            ET.fromstring(b);status='SVG_PARSED'
        elif ext in ('.png','.jpg','.jpeg','.webp','.gif'):
            with Image.open(io.BytesIO(b)) as im: im.verify()
            status='IMAGE_VERIFIED'
        elif ext=='.pdf':
            r=PdfReader(io.BytesIO(b));texts=[pg.extract_text() or '' for pg in r.pages]
            details.append({'path':row['path'],'pages':len(r.pages),'text_characters':sum(map(len,texts))});status='PDF_PARSED'
        elif ext in ('.zip','.docx','.xlsx'):
            with zipfile.ZipFile(io.BytesIO(b)) as z:
                assert z.testzip() is None
                if ext in ('.docx','.xlsx'):
                    for n in z.namelist():
                        if n.endswith('.xml') or n.endswith('.rels'):ET.fromstring(z.read(n))
            status={'.zip':'NESTED_ZIP_CRC_PASS','.docx':'DOCX_XML_PARSED','.xlsx':'XLSX_XML_PARSED'}[ext]
        elif ext=='.gz':
            raw=gzip.decompress(b)
            if p.name.endswith('.json.gz'):json.loads(raw)
            elif p.name.endswith('.csv.gz'):list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))))
            status='GZIP_PARSED'
        elif ext in ('.woff','.woff2','.ttf','.otf','.ico'):
            status='BINARY_HASHED'
        else:
            b.decode('utf-8-sig');status='TEXT_READ'
    except Exception as e:
        status='ERROR';issues.append({'path':row['path'],'error':type(e).__name__+': '+str(e)[:250]})
    summary[status]+=1
out={'files':len(rows),'formats':dict(summary),'issues':issues,'documents':details,'boundary':'All file bytes reread and SHA-256 matched. Structured formats parsed or integrity checked; binary font files hashed. This is not a manual editorial or visual review of every generated document/question.'}
OUTPUT.write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in out.items() if k!='documents'},ensure_ascii=False,indent=2))
