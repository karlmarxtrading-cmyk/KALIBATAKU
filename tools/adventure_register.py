"""Derive the 1.5.1 audit and master-prompt register from the current binding."""
import csv
from pathlib import Path
from native_receipt import verified as windows_status
ENGINES=['chromium','firefox','webkit']
ENTER=' '.join('enter-cycles-'+e for e in ENGINES)
JOURNEY=' '.join('journey-browser-'+e for e in ENGINES)
OFF=' '.join('offline-capability-'+e for e in ENGINES)
FREE=' '.join('catalog-offline-v151-'+e for e in ENGINES)
CASES={
 'NAV-01':ENTER+' AC:PILOT-01','NAV-02':JOURNEY+' AC:OFF-03','NAV-03':ENTER,'NAV-04':ENTER+' journey-model','NAV-05':'progression-bounds','NAV-06':FREE+' bank-preservation','NAV-07':'catalog-context','NAV-08':'start-intent',
 'UI-01':ENTER,'UI-02':ENTER,'UI-03':'AC:UX-09','UI-04':ENTER,'UI-05':'map-native-zoom v12-print-contrast v12-roles-reflow','UI-06':'AC:A11Y-04','UI-07':'ui-catalog-tokens v12-browser-chromium','UI-08':JOURNEY+' v12-browser-chromium',
 'PED-01':'learning-policy-160','PED-02':'learning-policy-160','PED-03':'player-ledger v12-feedback-export','PED-04':'viewed-coverage viewed-exports','PED-05':'learning-policy-160 AC:BANK-07 AC:PILOT-03','PED-06':'learning-policy-160 AC:PILOT-03','PED-07':'learning-policy-160 AC:BANK-07','PED-08':'progression-bounds',
 'DATA-01':'bank-preservation','DATA-02':'bank-occurrence-identity progression-bounds','DATA-03':'LOCAL','DATA-04':'semantic-restore capacity-browser','DATA-05':'period-readiness format-readiness viewed-exports',
 'OFF-01':OFF,'OFF-02':OFF,'REL-01':'portable-path-order WINDOWS','REL-02':'clean-build-twice AC:REL-05','REL-03':'AC:BANK-07','REL-04':'AC:TEACH-03','REL-05':'AC:PILOT-01 AC:PILOT-02 AC:PILOT-03','REL-06':'AC:REL-02 AC:REL-03 LOCAL','REL-07':'ALL','POST-01':'AC:PERF-03',
 'E01':ENTER,'E02':ENTER,'E03':ENTER,'E04':ENTER+' '+JOURNEY,'E05':ENTER+' route-faults','E06':ENTER,'E07':ENTER+' v12-browser-chromium','E08':ENTER+' v12-keyboard','E09':ENTER+' route-faults','E10':ENTER+' AC:UX-09',
 'J01':ENTER+' '+JOURNEY,'J02':ENTER+' progression-bounds '+OFF,'J03':'learning-policy-160 format-readiness progression-bounds','F01':'learning-policy-160 bank-preservation semantic-restore LOCAL','R01':OFF+' capacity-browser format-readiness LOCAL','R02':'clean-build-twice portable-path-order WINDOWS AC:REL-05'}
MASTER=['Enter menilai sekali pada indeks semula','Enter baru maju satu soal dan mengembalikan fokus','Enter ditahan tidak maju otomatis','Aktivasi ganda menjaga ledger','Simpan lambat, blur dan kembali','Input invalid dan IME','Simpan gagal, retry, lease, jeda dan resume','Kontrol sekunder memakai keyboard native','Finalisasi dan peluncuran berikut satu kali','Kesetaraan klik, sentuh dan keyboard sistem fisik','Profil baru, alur berurutan dan resume','Rekomendasi, cakupan dan form evaluasi','Urutan mikro, penguatan, review, denominator dan laporan','Bank frozen, ekstensi pool, riwayat lama dan rollback','Regresi offline, data dan laporan','Build native, binding dan pengemasan']
FINDINGS={'ADV-01':'NAV-03 NAV-04 NAV-05','ADV-02':'UI-01 OFF-02','ADV-03':'UI-02 UI-03','ADV-04':'PED-01 PED-02 PED-03','ADV-05':'PED-05','ADV-06':'PED-06','ADV-07':'PED-07','ADV-08':'NAV-06 NAV-07','ADV-09':'J01 AC:PILOT-01','ADV-10':'J01 NAV-03','TECH-151-01':'REL-01 R02','REL-151-01':'REL-07 REL-06 REL-05'}
def combine(items):
    items = ['BLOCKED' if s == 'BLOCKED_ENV' else s for s in items]
    for s in ('FAIL','BLOCKED','NOT_RUN'):
        if s in items:return s
    return 'PASS' if items and all(s=='PASS' for s in items) else 'NOT_RUN'
def rows(root,identity,suites,states,verified):
    import json
    folder=root/'evidence/v160/audit-input'
    def read(name):
        with (folder/name).open(encoding='utf-8-sig') as f:return list(csv.DictReader(f))
    local=root/'evidence/v161/update-local/update-rollback.json'
    l=json.loads(local.read_bytes()) if local.exists() else {}
    local_ok=l.get('candidate',{}).get('dist_tree_sha256')==identity['dist_tree_sha256'] and l.get('status')=='PASS'
    def value(k):
        if k=='LOCAL':return ('PASS' if local_ok else 'NOT_RUN',str(local.relative_to(root)))
        if k=='WINDOWS':return windows_status(root/'evidence/v161/native-windows',identity),'tools/native_receipt.py · .github/workflows/verify-native.yml'
        if k=='ALL':return combine([v for i,v in states.items() if i!='PERF-03']),'REGISTER_AC_FINAL.csv'
        if k.startswith('AC:'):return states[k[3:]],'REGISTER_AC_FINAL.csv#'+k
        return suites.get(k, {}).get('status', 'NOT_RUN') if verified else 'FAIL','evidence/v161/qa/'+k+'/log.txt'
    data=read('06_KRITERIA_PENERIMAAN.csv')
    masterkeys=[k for k in CASES if k[1:].isdigit()]
    assert len(masterkeys)==len(MASTER)
    data += [dict(id_usulan=k,kriteria=v,metode=CASES[k]) for k,v in zip(masterkeys,MASTER)]
    out=[]
    for r in data:
        id=r['id_usulan'];ev=[value(k) for k in CASES[id].split()]
        out.append(dict(id=id,kriteria=r['kriteria'],metode=r['metode'],status=combine([v for v,_ in ev]),hasil=' | '.join(k+'='+v for k,(v,_) in zip(CASES[id].split(),ev)),bukti=' | '.join(p for _,p in ev),build=identity['dist_tree_sha256']))
    byid={r['id']:r for r in out}
    findings=[]
    for r in read('05_TEMUAN_DAN_ARAHAN.csv'):
        ids=FINDINGS[r['id']].split();s=combine([byid[k]['status'] if k in byid else value(k)[0] for k in ids])
        findings.append(dict(id=r['id'],temuan=r['temuan'],tindakan=r['arahan'],status=s,pemilik=r['penanggung_jawab'],kriteria=' '.join(ids),reproduksi='REGISTER_PENERIMAAN.csv dan REGISTER_AC_FINAL.csv',build=identity['dist_tree_sha256']))
    return out,findings
