"""Publish the offline, searchable evidence guide and validate all referenced files."""
import csv,json,os
from collections import Counter
from html import escape as esc
from html.parser import HTMLParser
from pathlib import Path
from project import ROOT
out=ROOT/'evidence'
def rows(name):
    with (ROOT/name).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def link(path,name):
    assert (ROOT/path).is_file(),path
    rel=os.path.relpath(ROOT/path,out)
    return f'<a href="{esc(rel,quote=True)}">{esc(name)}</a>'
sources=[
 ('evidence/v12/original-bank.json','Identitas seluruh berkas bank'),('evidence/v12/bank-model.json','Oracle kunci dan langkah'),
 ('evidence/v12/browser-chromium.json','Chromium 158'),('evidence/v12/browser-firefox.json','Firefox 153'),('evidence/v12/browser-webkit.json','WebKit 26.5'),
 ('evidence/v12/reports/feedback-ledger.json','Respons pertama dan revisi dalam lima mode'),('evidence/acceptance/final-build-binding.json','Hash dan observasi per suite'),
 ('evidence/v12/print-contrast.json','Hasil kontras dan cetak 5 halaman'),('evidence/v12/reports/inspection.json','Pemeriksaan PDF, DOCX, XLSX, CSV dan JSON'),('evidence/ux/performance/performance-summary.json','Uji cold/warm dan budget lengkap'),('evidence/deployment/static-http-https.json','Hosting lokal HTTP/HTTPS'),('evidence/deployment/clean-build.json','Dua build deterministik'),('evidence/v12/input/04_RENCANA_PENUTUPAN_PRODUKSI.md','Protokol uji perangkat, peserta dan server'),('evidence/v12/bank/editorial-roster.csv','Roster penelaah editorial'),('evidence/v12/historical-1.1.0.zip','Bukti historis rilis 1.1.0')]
def render():
    status=json.loads((ROOT/'RELEASE_STATUS.json').read_bytes());metrics=json.loads((out/'acceptance/final-build-binding.json').read_bytes())
    parts=['''<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>KALIBATAKU 1.2.0 · Hasil uji</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f6f4ee;color:#1c3029;font:16px/1.55 system-ui,sans-serif}main{max-width:70rem;margin:auto;padding:clamp(16px,4vw,52px)}h1{font:600 clamp(2.2rem,5vw,3.7rem)/1.09 Georgia,serif;margin:.5rem 0}h2{font:600 1.7rem Georgia,serif;margin:1.7em 0 .55em}a{color:#175947}a:hover{text-decoration-thickness:2px}header{border-bottom:1px solid #a9b8ae;padding-bottom:1.1rem}nav,.sources{display:flex;flex-wrap:wrap;gap:.5rem 1.4rem}section{margin:1.4rem 0}details{background:#fff;border:1px solid #cdd6ce;border-radius:8px;padding:.65rem .85rem;margin:.4rem 0}summary{cursor:pointer}small{font-size:.85rem}label{display:inline-grid;gap:.2rem;margin-right:1rem}select,input{font:inherit;padding:.5rem;border:1px solid #7b8e82;border-radius:5px}figure{margin:0}figure img{display:block;width:100%;height:200px;object-fit:cover;object-position:center;border-radius:5px}figcaption{padding:.4rem 0}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:1rem}code{overflow-wrap:anywhere}li{padding:.13rem}a:focus-visible,summary:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #b17019} @media(prefers-color-scheme:dark){body{background:#15251f;color:#eff7f1}a{color:#91dbbb}details{background:#1b3027;border-color:#56705e}}
    </style><main><header><p>KALIBATAKU · 1.2.0</p><h1>Hasil pengujian</h1><p><strong>HOLD untuk produksi penuh.</strong> Website dan bank siap dibuka melalui hosting statis. Anggaran lama player, perangkat fisik, teknologi bantu dan validasi manusia masih tercantum sebagai pekerjaan terbuka.</p>
    <nav><a href="#bukti">Bukti utama</a><a href="#contoh">Tampilan dan laporan</a><a href="#register">Kriteria dan temuan</a></nav></header>''']
    parts.append('<h2 id="bukti">Bukti utama</h2><p>4.604 paket · 177.640 penempatan · 168.142 ekspresi unik · 386.834 langkah penyelesaian.</p><p>Distribusi SHA-256 <code>'+esc(metrics['dist_tree_sha256'])+'</code>. Sebanyak '+str(metrics['observed_assertions'])+' observasi pada '+str(len(metrics['receipts']))+' hasil uji browser terikat pada build ini. Satu observasi dapat mendukung beberapa kriteria.</p><ul>'+''.join('<li>'+link(p,n)+'</li>' for p,n in sources)+'</ul>')
    pictures=[('sebelum-oke','Soal sebelum OKE'),('feedback-revisi','Revisi sesudah kunci terbuka'),('pecahan-oke','Jawaban 21/12 dan kunci 7/4'),('kontras-tinggi','Fokus pada mode kontras tinggi'),('reports/pecahan-pdf','Laporan PDF'),('reports/pecahan-docx','Persamaan Word setelah dirender')]
    parts.append('<h2 id="contoh">Tampilan dan laporan</h2><div class="gallery">'+''.join(f'<figure><a href="v12/{p}.png"><img loading="lazy" src="v12/{p}.png" alt="{n}"></a><figcaption>{n}</figcaption></figure>' for p,n in pictures)+'</div><p class="sources">'+''.join(link('evidence/v12/reports/pecahan.'+f,'Contoh '+f.upper()) for f in ['pdf','docx','xlsx','csv','json'])+link('evidence/v12/reports/cetak-id.pdf','Cetak ID')+link('evidence/v12/reports/cetak-en.pdf','Cetak EN')+'</p>')
    parts.append('''<h2 id="register">Kriteria dan temuan</h2><p>Buka baris untuk membaca hasil, status sebelumnya, bukti dan syarat penerimaan yang tersisa.</p>
    <label>Cari ID atau judul<input type="search" id="query"></label><label>Status<select id="filter"><option value="">Semua</option>'''+''.join(f'<option>{k}</option>' for k in ['PASS','FAIL','BLOCKED','NOT_RUN','FIXED_VERIFIED','PARTIALLY_VERIFIED'])+'</select></label><p role="status" id="count"></p>')
    for name,file,fields in [('Kriteria sumber','ACCEPTANCE_RESULTS.csv',('acceptance_id','judul','status_build_baru','hasil_aktual','path_bukti')),('Kriteria matematika dan feedback','ACCEPTANCE_FM.csv',('criterion_id','title','status_new_build','actual_result','evidence_path')),('Penutupan audit','AUDIT_CLOSURE.csv',('origin_id','title','status_build_baru','hasil_aktual','bukti'))]:
        r=rows(file);parts.append(f'<section><h3>{name} ({len(r)})</h3><p>'+link(file,'Buka register CSV')+'</p>')
        for row in r:
            key,title,state,actual,paths=[row[x] for x in fields];parts.append(f'<details data-status="{esc(state)}"><summary><strong>{esc(key)}</strong> · {esc(title)} · {esc(state)}</summary><p>{esc(actual)}</p><p>Status pada baseline: {esc(row["baseline_status"])}.</p>')
            if row.get('sisa'):parts.append('<p><strong>Masih terbuka</strong> · '+esc(row['sisa'])+'</p>')
            parts.append('<ul>'+''.join('<li>'+link(p,p)+'</li>' for p in paths.split(' | ') if p)+'</ul></details>')
        parts.append('</section>')
    parts.append('''<script>const q=document.getElementById('query'),f=document.getElementById('filter'),items=[...document.querySelectorAll('details')];function update(){let n=0;for(const el of items){el.hidden=(f.value&&el.dataset.status!==f.value)||!el.querySelector('summary').textContent.toLowerCase().includes(q.value.trim().toLowerCase());if(!el.hidden)n++}document.getElementById('count').textContent=n+' baris ditampilkan';}q.addEventListener('input',update);f.addEventListener('change',update);update();</script></main></html>''')
    page=''.join(parts);(out/'00_HASIL_UJI.html').write_text(page)
    class Check(HTMLParser):
        def __init__(self):super().__init__();self.paths=set()
        def handle_starttag(self,tag,attrs):
            for k,x in attrs:
                if k in ('src','href') and not x.startswith('#'):self.paths.add(x)
    p=Check();p.feed(page)
    assert all((out/x).is_file() for x in p.paths)
    (out/'deployment/evidence-index-links.json').write_text(json.dumps({'status':'PASS','links_checked':len(p.paths),'rows':194,'verified_paths':sorted(p.paths)},indent=2))
if __name__=='__main__':render()
