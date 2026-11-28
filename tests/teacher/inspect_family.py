"""Independent readers check the family-facing first page and author-edited plan."""
from pathlib import Path
import hashlib, json, subprocess, tempfile
import fitz
from docx import Document
root=Path(__file__).resolve().parents[2]
out=root/'evidence/ux/school'
s=json.loads((out/'keluarga-demo-04.json').read_text())
plan=s['plan']
rows=[]
with tempfile.TemporaryDirectory() as tmp:
    source=out/'keluarga-demo-04.docx'
    doc=Document(source)
    ps=' '.join(p.text for p in doc.paragraphs)
    assert plan in ps and 'SIMULASI' in ps and s['notes'][0]['text'] not in ps
    subprocess.run(['soffice','-env:UserInstallation=file://'+tmp+'/profile','--headless','--convert-to','pdf','--outdir',tmp,str(source)],check=True,capture_output=True)
    for label,p in [('PDF',out/'keluarga-demo-04.pdf'),('DOCX rendered',Path(tmp)/'keluarga-demo-04.pdf')]:
        with fitz.open(p) as pdf:
            txt=' '.join(' '.join(page.get_text().split()) for page in pdf)
            assert 1<=len(pdf)<=2
            for part in (s['person']['alias'],'SIMULASI','DEMONSTRATION DATA','Yang sudah terlihat','Fokus pendampingan','Rencana latihan berikutnya',plan,s['reviewDate']): assert part in txt,(label,part)
            assert s['notes'][0]['text'] not in txt and s['activeNotes'][0]['text'] in txt
            assert 'P90' not in txt
            for page in pdf:
                for x0,y0,x1,y1,*_ in page.get_text('blocks'):assert 0<=x0<x1<=page.rect.width and 0<=y0<y1<=page.rect.height
            pdf[0].get_pixmap(matrix=fitz.Matrix(.9,.9)).save(out/('keluarga-'+label.split()[0].lower()+'-hal1.png'))
            rows.append({'format':label,'pages':len(pdf),'subject':s['person']['id'],'present':['source','strength','priority','practice plan','review date','active teacher note'],'source_sha256':hashlib.sha256((source if label.startswith('DOCX') else p).read_bytes()).hexdigest()})
(out/'family-layout.json').write_text(json.dumps({'status':'PASS','actual':rows,'limits':'Rendered/extracted with PyMuPDF and LibreOffice. Participant comprehension and physical assistive technology require separate trials.'},indent=2))
print(rows)
