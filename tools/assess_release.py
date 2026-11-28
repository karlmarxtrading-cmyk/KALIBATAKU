"""RETIRED in 1.3.0. assess_release.py (1.2.0) assigned PASS from the existence of evidence files and did not re-validate the binding (audit TECH-02). It is retired. Use: npm run qa:production && npm run qa:assess

The original 1.2.0 source is kept below for reference and is never executed."""
import sys
print('assess_release.py (1.2.0) assigned PASS from the existence of evidence files and did not re-validate the binding (audit TECH-02). It is retired. Use: npm run qa:production && npm run qa:assess', file=sys.stderr)
sys.exit(2)

# ---- original 1.2.0 source (inert) ----
# """Build current release registers from observed results and the untouched historical contract."""
# from pathlib import Path
# from zipfile import ZipFile
# from collections import Counter
# import csv,io,json,re
# from project import ROOT,DIST,tree_hash
# import jsonschema
# 
# def read(rel):return json.loads((ROOT/rel).read_bytes())
# def csvread(text):return list(csv.DictReader(io.StringIO(text.lstrip('\ufeff'))))
# def writecsv(rel,rows):
#     with (ROOT/rel).open('w',newline='',encoding='utf-8-sig') as f:
#         w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
# def refs(*items):
#     return list(dict.fromkeys(p for item in items for p in pool.get(item,[item])))
# def checked(paths):
#     for p in paths:assert (ROOT/p).is_file(),p
#     return ' | '.join(paths)
# def assigned(table,nums,names,actual):
#     for n in nums.split():table[int(n)]=(refs(*names.split()),actual)
# base='evidence/'
# v=base+'v12/'
# ux=base+'ux/acceptance/browser-'
# acdir=base+'acceptance/browser-'
# pool={k:[ux+k+'-ux.json'] for k in ['shell','school','player','data','reflow','visual']}
# for k in ['journeys','teacher','semantics','layout','performance','offline','faults']:pool[k]=[acdir+k+'.json']
# pool.update(new=[v+'browser-'+k+'.json' for k in ('chromium','firefox','webkit')],cross=[v+'cross/'+k+'/browser-'+s+'.json' for k in ['firefox','webkit'] for s in ['data','offline','teacher']],ledger=[v+'reports/feedback-ledger.json'],model=[v+'bank-model.json'],mathbank=[v+'original-bank.json',base+'bank/independent-distribution-audit.json'],exports=[v+'reports/inspection.json',base+'teacher/validation.json',base+'ux/school/report-domain.json'],print=[v+'print-contrast.json'],contract=[base+'data/contract-results.json',base+'data/openapi-validation.json'],upgrade=[base+'ux/upgrade/original-backup-roundtrip.json',base+'ux/bank/snapshot-upgrade.json'],bind=[base+'acceptance/final-build-binding.json'],budget=[base+'ux/performance/performance-summary.json',base+'ux/performance/bundle-gzip.csv'],keys=[base+'ux/acceptance/keyboard.json'],plan=[v+'input/04_RENCANA_PENUTUPAN_PRODUKSI.md'],roster=[v+'bank/editorial-roster.csv'])
# acmap={};fmmap={}
# assigned(acmap,'1 2 3 7 12 19 21 22 23 26 27','player new ledger','Alur player, pratinjau dan ledger diperiksa pada build ini. Bukti mencatat isian mentah, revisi, hasil dan urutan event.')
# assigned(acmap,'4 5 6 36 37 38 39 40 47','school teacher new','Uji sekolah menjalankan pilihan siswa, sumber laporan, penugasan dan penyimpanan draf melalui kontrol aplikasi.')
# assigned(acmap,'8 28','player data','Perubahan draf, kegagalan kuota, pemulihan dan transaksi lintas tab dijalankan pada penyimpanan browser.')
# assigned(acmap,'9 10 11 13 14 15 16','shell journeys','Rute, profil, pilihan kurikulum, katalog dan setup dijalankan dari antarmuka yang diterbitkan.')
# assigned(acmap,'17 18','new faults','Permintaan gagal dan lambat, kesiapan player, URL serta navigasi diuji di server pratinjau.')
# assigned(acmap,'20 24 25 29 31 32 33 34 35','journeys player ledger','Lima mode, input lokal, rekomendasi, review, metrik dan navigasi dilacak melalui kontrol dan snapshot.')
# assigned(acmap,'41 42 43 44 45','school teacher exports print','Berkas hasil dibaca kembali melalui parser independen. Periksa contoh laporan, render halaman dan keluaran worker.')
# assigned(acmap,'46 48 49 51','visual shell new model','Dua bahasa dan tema diuji pada komponen serta halaman nyata, termasuk preservasi notasi dan preferensi.')
# assigned(acmap,'50','print new visual','Kontras pada latar aktual diukur untuk label, garis pecahan, tombol dan fokus. Status tersedia sebagai teks, termasuk saat forced-colors.')
# assigned(acmap,'30 52 53 55 56 57 58','reflow new keys','Viewport nyata pada browser desktop, tombol dan keyboard diuji. Batas perangkat serta pendengar tercatat dalam kolom sisa.')
# assigned(acmap,'54','keys shell new','Tombol Tab dan Enter menghasilkan dua respons benar melalui alur keyboard. Event tepercaya dan fokus direkam.')
# assigned(acmap,'59','new cross','Chromium, Firefox dan WebKit desktop menjalankan alur soal, fallback, pemulihan data, worker, berkas unduhan dan offline.')
# assigned(acmap,'60 61 62 63 64','offline data cross upgrade','Pemasangan offline, outage HTTP, pembaruan, rollback, backup dan pemulihan diuji pada data lokal sintetis.')
# assigned(acmap,'65 66 67','contract data','Kontrak event, antrean, ACK dan retry diuji dengan adapter serta fixture kegagalan.')
# assigned(acmap,'68 69 70 71','performance budget','Jejak resource, gzip per berkas, latency dan skala laboratorium tersimpan. Angka p75 lapangan memerlukan trafik produksi.')
# assigned(acmap,'72 73 74 75','mathbank model upgrade','Identitas berkas, cakupan, kunci dan langkah dihitung. Untuk kalibrasi pedagogis diperlukan penilaian tersendiri.')
# assigned(acmap,'76 77 78 79','plan','Protokol dan tugas per peran tersedia untuk pelaksanaan dengan peserta nyata.')
# assigned(acmap,'80','bind plan','Hash serta hasil teknis tersedia. Penerimaan menyeluruh mengikuti gate yang terbuka.')
# assigned(fmmap,'1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18','new player ledger','Kontrol aplikasi, snapshot sebelum/sesudah dan urutan event diuji. Bukti memuat nilai yang diharapkan dan nilai aktual.')
# assigned(fmmap,'19 20 21 22 23 24 25 26 28','model new','Oracle memeriksa seluruh bank dan langkah. Set 32 fixture dirender per mesin dalam dua bahasa dan dua tema.')
# assigned(fmmap,'27','new exports print ledger','Model AST digunakan di player, rincian, review dan laporan. File persamaan, tampilan dan keluaran cetak diperiksa.')
# assigned(fmmap,'29 30','new mathbank evidence/deployment/asset-review.json tools/mathjax-files.json evidence/v12/vendor-packages.txt','Versi lokal, hash byte vendor dan request origin diverifikasi. Glyph aritmetika memakai data SVG bawaan.')
# assigned(fmmap,'31 32 33 34 35','new budget offline cross','Startup dengan penundaan 1.500 ms, pembatalan DOM, gagal HTTP 503 lalu retry 200, serta cache/update/rollback diuji.')
# assigned(fmmap,'36 46','exports print','DOCX memiliki pecahan OMML. PDF vektor dan cetak browser berhalaman diperiksa kembali untuk bahasa ID dan EN.')
# assigned(fmmap,'37','new reflow','Lebar 320–1.440 px, teks hingga 200%, batas operator dan 32 ekspresi diukur pada browser.')
# assigned(fmmap,'38 39 40 41 42 44','new keys plan','Uji desktop dan protokol tersedia. Bukti fisik/pendengar masih dibutuhkan sesuai target.')
# assigned(fmmap,'43','print new visual','Pasangan warna pada layar, garis pecahan, outline, teks status dan forced-colors diuji pada antarmuka.')
# assigned(fmmap,'45','new cross','Tiga mesin desktop asli menjalankan alur, backup, ekspor dan offline dengan versi serta lingkup eksplisit.')
# assigned(fmmap,'47','bind','Hash dist dan identitas yang diamati browser ditautkan. Matriks baseline dan build ini dibuat terpisah.')
# assigned(fmmap,'48','plan','Tugas, pertanyaan dan rubrik tersedia. Pemahaman peserta membutuhkan observasi langsung.')
# fm_detail={
#     1:'OKE-REVISE dan S08. CTA ganti dari periksa menjadi lanjut pada kartu hasil.',
#     2:'FRACTION. Jawaban benar 21/12 langsung menampilkan kunci 7/4.',
#     3:'OKE-REVISE. 999 tetap ada sebagai jawaban mentah pertama. Kunci yang terlihat adalah 5.',
#     4:'OKE-REVISE. Mengirim string kosong meninggalkan history kosong.',
#     5:'OKE-REVISE. Tanda minus, 1/, 1/0 dan teks bukan angka menghasilkan galat format tanpa submission.',
#     6:'FRACTION. Jawaban 21/12 pada 11/12 + 10/12 mendapat “Nilainya sama”.',
#     7:'DECIMAL. Berpindah ID → EN mempertahankan 55,3 di history dan menampilkan 20.0 + 35.3.',
#     8:'OKE-REVISE. Sesudah OKE dan Enter kedua, indeks soal masih nol.',
#     9:'OKE-REVISE, S01 dan GRADE-RETRY. Revisi memiliki ID berbeda. Retry dari transaksi gagal mempertahankan ID event yang sama.',
#     10:'Keyboard. CTA soal terakhir membawa siswa ke konfirmasi dan pengiriman final secara terpisah.',
#     11:'OKE-REVISE. first_correct=false dan final_correct=true untuk 999 → 5. Hasil dua soal 2/2 dengan respons pertama 1/2.',
#     12:'Lima mode pada feedback-ledger.json. hint_before, key_seen_before dan key_reveal_reason diperiksa terpisah.',
#     13:'Setelah kunci, revisi benar tetap menghasilkan hitungan benar mandiri nol untuk contoh laporan.',
#     14:'ASSESSMENT. Sesudah Save, key_revealed_at masih kosong dan kartu benar/salah belum tampil.',
#     15:'ASSESSMENT. Tinjauan setelah final memuat respons, kunci dan metode.',
#     16:'SPEED dan SLOW-START. Deadline sama sebelum dan sesudah membaca feedback. Jam mulai setelah soal siap.',
#     17:'S01-preview dan S01-final. Draf 5 dan 4 pada dua soal menghasilkan 2 benar, 0 kosong, empat event berurutan.',
#     18:'GRADE-RETRY. Kuota sengaja digagalkan pada penulisan event. Nilai tetap terlihat, lalu ID event semula tersimpan satu kali.',
#     19:'32 fixture, struktur operator terbatas, validator numerik dan oracle bank pada bank-model.json.',
#     20:'MATH-32. Empat operasi dirender melalui MathJax lokal pada tiga mesin, di kedua tema dan bahasa.',
#     21:'FRACTION. Pembilang 10 dan penyebut 12 pada soal dipertahankan meskipun nilai kanonis 5/6.',
#     22:'MATH-32 dan model. Dua susunan kurung untuk pembagian diperiksa terhadap nilai fixture eksak.',
#     23:'MATH-32 dan model. Ujaran serta token matematika untuk bilangan negatif tercatat per locale.',
#     24:'DECIMAL. Bentuk 20,0/20.0 mempertahankan satu tempat desimal.',
#     25:'Model dan fixture. Pengurangan serta pembagian bertingkat dibedakan berdasarkan AST.',
#     26:'Perbandingan nilai fixture menggunakan aritmetika rasional eksak pada bilangan besar.',
#     27:'Model rumus dipakai pada soal, hint, langkah, kunci, respons, review dan bukti laporan. Contoh DOCX memuat empat pecahan OMML yang dibaca parser.',
#     28:'DECIMAL. Langkah antara 20,0 + 35,3 menjadi 50 + 5,3 pada tampilan siswa.',
#     29:'MathJax dan data font 4.1.3 dipin ke dua SHA-512 tarball dan delapan digest berkas upstream.',
#     30:'ORIGIN dan offline. Seluruh request aplikasi bersumber dari origin lokal. Aset aritmetika terpasang melalui cache versi.',
#     31:'Tidak ada vendor MathJax pada halaman awal dalam lima navigasi dingin. Runtime SVG dimuat saat player membutuhkan rumus.',
#     32:'SLOW-START. Penundaan 1.500 ms menunjukkan ready=false, deadline=null. Sesudah SVG siap, durasi penuh 60 detik tersedia.',
#     33:'LIFECYCLE. Node pertama yang dibersihkan sebelum promise selesai memiliki nol SVG. Node pengganti selesai dirender.',
#     34:'LOAD-FAILURE. Respons runtime 503 menghasilkan fallback linear. Retry 200 memulihkan SVG, isian 42 tetap ada.',
#     35:'Offline. Paket terpilih dipasang, origin diputus saat reload, lalu pembaruan dan rollback dilakukan pada fixture lokal.',
#     36:'OMML di DOCX, PDF vektor, spreadsheet serta JSON diperiksa secara independen. Dokumen Word dirender melalui LibreOffice.',
#     37:'REFLOW dan LIFECYCLE. Kartu feedback tetap dalam lebar halaman pada 320 px/200%. Semua 32 fixture diukur dalam wadah pembacaan sempit.',
#     43:'Rasio teks, simbol dan fokus pada latar aktual tercantum di print-contrast.json. Status tertulis dan forced-colors diuji.',
#     45:'Chromium 158, Firefox 153 dan WebKit 26.5 mengerjakan soal, retry, offline, penyimpanan serta enam format unduhan.',
#     46:'Cetak browser dari tema gelap menghasilkan 5 halaman untuk ID dan 5 untuk EN pada 64 sesi simulasi. Semua halaman dirasterisasi dan batas kata diperiksa.',
#     47:'Identitas browser cocok dengan dist. Bukti 1.1.0 tetap berada di arsip historis. Versi aktif memakai 80 AC, 48 FM dan 66 baris temuan.'}
# def main():
#     with ZipFile(ROOT/v/'historical-1.1.0.zip') as z:
#         original=lambda n:csvread(z.read(n).decode('utf-8-sig'))
#         ac=original('ACCEPTANCE_RESULTS.csv');old=original('AUDIT_CLOSURE.csv')
#     fm=csvread((ROOT/v/'input/KRITERIA_TAMBAHAN_FM.csv').read_text())
#     findings=csvread((ROOT/v/'input/REGISTER_TEMUAN.csv').read_text())
#     assert len(ac)==80==len(acmap) and len(fm)==48==len(fmmap) and len(old)==47 and len(findings)==19
#     bind=read('evidence/acceptance/final-build-binding.json');stamp=bind['offline_release'];digest=bind['dist_tree_sha256']
#     assert read('evidence/deployment/clean-build.json')['dist_sha256']==digest==tree_hash(DIST)
#     assert all(read(f)['status']=='PASS' for f in [v+'reports/inspection.json',v+'print-contrast.json',v+'bank-model.json',v+'original-bank.json','evidence/deployment/asset-review.json','evidence/deployment/static-http-https.json'])
#     env='Linux x86_64, HTTP lokal. Chromium 158, Firefox 153, WebKit 26.5 sesuai bukti. Data uji sintetis.'
#     date='2026-11-26'; ident='dist '+digest+' / offline '+stamp
#     limits={30:'Perlu keyboard dan caret pada perangkat Android dan iOS fisik.',45:'Perlu pendengar pembaca layar pada laporan HTML.',53:'Perlu observasi salah ketuk serta jarak kontrol pada perangkat fisik.',55:'Perlu perangkat Android dan IME sistem.',56:'Perlu Safari iPhone/iPad dan Files pada perangkat fisik.',57:'Perlu IME asli dengan composition pada perangkat sasaran.',58:'Perlu rekaman ujaran NVDA, TalkBack dan VoiceOver.',67:'Perlu endpoint institusi, akun dan ACL lintas kelas serta penilai server.',70:'Perlu host final dan trafik pengguna nyata untuk p75.',74:'Perlu penelaah matematika dan bahasa untuk 394 keluarga template.',76:'Perlu siswa baru dan kembali.',77:'Perlu guru peserta.',78:'Perlu operator peserta.',79:'Perlu orang tua peserta.',80:'Masih terdapat gate WAJIB_STATIC terbuka. Domain akhir juga belum diuji.'}
#     per=read('evidence/ux/performance/performance-summary.json')
#     for r in ac:
#         n=int(r['acceptance_id'][3:]);paths,obs=acmap[n];state='PASS';remain=limits.get(n,'')
#         if remain:state='NOT_RUN' if n in (70,76,77,78,79) else 'BLOCKED'
#         if n in (68,69,71):
#             state=per['checks'][r['acceptance_id']];assert state in ('PASS','FAIL')
#             if n==68:
#                 b=next(x for x in per['budgets'] if 'original AC-068' in x['group']);obs=f"Dengan MathJax, tambahan player {b['gzip_bytes']/1024:.1f} KiB gzip. Anggaran historis 90 KiB. Anggaran teknis 1.2 tercatat di DECISIONS.md.";remain='Ambang 90 KiB perlu optimasi lebih lanjut atau penerimaan eksplisit atas anggaran 1.2.'
#             if state=='FAIL' and n!=68:remain='Lihat pengamatan angka dan batas pengukuran pada lampiran performa.'
#         if n==74:paths+=refs('roster')
#         if n==52:paths=paths+[v+'roles-reflow.json']
#         r.update(baseline_status=r['status'],status=state,status_build_baru=state,hasil_aktual=obs,path_bukti=checked(paths),build_yang_diuji=ident,tanggal_uji=date,pelaksana='QA teknis',lingkungan=env,sisa=remain)
#     writecsv('ACCEPTANCE_RESULTS.csv',ac)
#     pending={38:'Android fisik.',39:'Safari dan Files pada iPhone/iPad fisik.',40:'IME fisik.',41:'Pendengar NVDA.',42:'Pendengar VoiceOver dan TalkBack.',44:'Observasi sentuh fisik.',48:'Peserta siswa, guru dan keluarga.'}
#     for r in fm:
#         n=int(r['criterion_id'][3:]);paths,obs=fmmap[n];st='BLOCKED' if n in pending else 'PASS'
#         if n==48:st='NOT_RUN'
#         obs=fm_detail.get(n,obs)
#         r.update(baseline_status='NOT_RUN',status_new_build=st,actual_result=obs,build_hash=ident,environment=env,evidence_path=checked(paths),tester='QA teknis',tested_at=date,sisa=pending.get(n,''))
#     writecsv('ACCEPTANCE_FM.csv',fm)
#     rec={r['acceptance_id']:(r['status'],r['path_bukti'],r['sisa']) for r in ac}
#     rec.update({r['criterion_id']:(r['status_new_build'],r['evidence_path'],r['sisa']) for r in fm})
#     closure=[]
#     for r in old+findings:
#         original='origin_id' in r;key=r.get('origin_id',r.get('id'));links=re.findall(r'(?:AC|FM)-\d+',r['acceptance_check_ids'] if original else r['related_fm']+' '+r['related_source_ac'])
#         if key=='S08':links=['FM-002','FM-003','FM-012','FM-014']
#         if key=='S12':links+=['FM-048']
#         linked=[rec[k] for k in links];open_ids=[k for k in links if rec[k][0]!='PASS']
#         paths=[p for row in linked for p in row[1].split(' | ') if p];state='PARTIALLY_VERIFIED' if open_ids else 'FIXED_VERIFIED' if linked else 'NOT_RUN'
#         closure.append(dict(origin_id=key,priority=r['priority'],title=r['title'],baseline_status=r['status'],status_build_baru=state,acceptance_id=' | '.join(links),build_hash=ident,bukti=checked(list(dict.fromkeys(paths))),hasil_aktual=('Penayangan kunci langsung menggantikan kebijakan S08 lama. ' if key=='S08' else '')+'Lihat hasil serta observasi setiap kriteria terkait.',sisa=' | '.join(open_ids)))
#     writecsv('AUDIT_CLOSURE.csv',closure)
#     def entry(status,evidence,summary,blockers=[]):checked(evidence);return dict(status=status,evidence=evidence,claim_boundary=summary,blockers=blockers)
#     mandatory=[r['acceptance_id'] for r in ac if r['gate']=='WAJIB_STATIC' and r['status']!='PASS']+[r['criterion_id'] for r in fm if r['release_gate']=='WAJIB_STATIC' and r['status_new_build']!='PASS']
#     ds={'static_application':entry('HOLD' if mandatory else 'PASS',['ACCEPTANCE_RESULTS.csv','ACCEPTANCE_FM.csv','AUDIT_CLOSURE.csv'],'Build statis lengkap untuk hosting. Penerimaan seluruh gate produksi mengikuti dua register.',mandatory),'bank_content':entry('PASS',refs('model','mathbank'),'4.604 paket, 177.640 penempatan, 168.142 ekspresi unik dan 386.834 langkah diperiksa.'),'bridge_contract':entry('PASS',refs('contract','ledger','data'),'Kontrak, retry, ACK, isolasi dan pemulihan diuji memakai fixture.'),'live_lms':entry('DEFERRED_BY_SCOPE',['docs/bridge/README.md'],'Endpoint sekolah, akun berperan dan verifikasi nilai server diperlukan.'),'pedagogical_calibration':entry('NOT_PERFORMED',refs('roster','plan'),'1.186 sampel tersedia untuk penelaah yang memeriksa 394 keluarga template.'),'user_validation':entry('NOT_PERFORMED',refs('plan'),'Pilot siswa, guru, operator dan orang tua belum dilakukan.'),'live_deployment':entry('PREVIEW_PASS',['evidence/deployment/static-http-https.json','evidence/deployment/clean-build.json'],'HTTP/HTTPS root dan subfolder lulus di pratinjau lokal. Deployment publik memerlukan host pemilik.')}
#     status=dict(artifact_status='release_verdict',release_id='kalibataku-static-1.2.0',readiness=ds);jsonschema.validate(status,read('docs/contracts/release-status-1.2.schema.json'))
#     (ROOT/'RELEASE_STATUS.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n')
#     def totals(states):return ', '.join(f'{v} {k}' for k,v in Counter(states).items())
#     lines=['# KALIBATAKU 1.2.0 · Status rilis','','**HOLD untuk produksi penuh.** Folder dist dapat dipasang dan diuji sekarang.','',f"AC (80) · {totals(r['status'] for r in ac)}. FM (48) · {totals(r['status_new_build'] for r in fm)}. Register temuan mencakup 47 historis dan 19 dari audit ini.",'','| Lingkup | Status | Hasil |','|---|---|---|']+[f"| {k} | {x['status']} | {x['claim_boundary']} |" for k,x in ds.items()]+['','## Gate wajib yang masih terbuka','']+[f"- **{a}** · {rec[a][2]}" for a in mandatory]+['',f'Build dist SHA-256 `{digest}`.','', '[Buka indeks uji](evidence/00_HASIL_UJI.html)']
#     (ROOT/'STATUS_RILIS.md').write_text('\n'.join(lines)+'\n');print(lines[4])
# if __name__=='__main__':main()
