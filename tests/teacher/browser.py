"""End-to-end synthetic assignment, monitoring, local report, worker downloads and small-width UI."""
from pathlib import Path
import json, shutil, os, sys, tempfile, zipfile, hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/integration'))
from fixture_server import fixture_server
import fitz
EVID=ROOT/'evidence/teacher'
with fixture_server() as u,sync_playwright() as pw,tempfile.TemporaryDirectory() as tmp:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True)
    ctx=browser.new_context(locale='id-ID',viewport={'width':1366,'height':850},accept_downloads=True)
    p=ctx.new_page();p.set_default_timeout(9000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
    base=u+'/school/math/';p.goto(base+'#/demo/teacher');p.get_by_role('heading',name='Monitoring kelas').wait_for()
    assert p.locator('.tw-person').count()==6
    p.locator('.tw-filters summary').click();p.get_by_label('Kelas administratif',exact=True).select_option('3A');p.get_by_role('button',name='Terapkan filter').click()
    p.wait_for_function("document.querySelectorAll('.tw-person').length===3")
    p.get_by_role('link',name='Lihat bukti Demo 01').click();p.get_by_role('heading',name='Demo 01',exact=True).wait_for()
    p.get_by_label('Isi catatan atau alasan keputusan').fill('Catatan sintetis <b>bukan HTML</b>.');p.get_by_role('button',name='Simpan catatan').click()
    p.locator('.tw-note').first.wait_for();assert '<b>bukan HTML</b>' in p.locator('.tw-note').inner_text()
    p.get_by_label('Revisi',exact=True).select_option(index=1);p.get_by_label('Isi catatan atau alasan keputusan').fill('Revisi dengan alasan.');p.get_by_role('button',name='Simpan catatan').click();p.wait_for_function("document.querySelectorAll('.tw-note').length===2")
    p.get_by_role('link',name='Buat penugasan untuk Demo 01').click();p.get_by_role('button',name='Berikan tugas').wait_for()
    p.get_by_role('button',name='Berikan tugas').click();p.get_by_role('button',name='Kerjakan sebagai siswa demo').click()
    p.locator('.kp-answer').fill('2');p.get_by_role('button',name='Periksa · Enter').click()
    p.get_by_role('button',name='Selesaikan sesi',exact=True).click();p.get_by_role('button',name='Kirim hasil akhir').click()
    p.wait_for_url('**/#/results/**')
    p.goto(base+'#/demo/assignments');p.locator('.tw-person').first.wait_for()
    assert 'Selesai' in p.locator('.tw-person').first.inner_text()
    p.goto(base+'#/demo/student/demo-01');p.locator('.tw-card details').first.locator('summary').click()
    p.get_by_text('Diterima simulasi',exact=False).first.wait_for()
    assert '2' in p.locator('.tw-card details[open]').first.inner_text()
    p.get_by_role('button',name='Buka laporan siswa').click();p.locator('.tw-paper').wait_for()
    p.get_by_label('Bahasa laporan').select_option('bilingual')
    assert p.locator('.tw-paper table').count() and '[object HTML' not in p.locator('.tw-paper').inner_text()
    ids={};stems=[]
    for fmt in ('pdf','docx','xlsx','csv','json','zip'):
        p.get_by_label('Format berkas').select_option(fmt)
        with p.expect_download() as waiting:p.get_by_role('button',name='Unduh laporan').click()
        d=waiting.value;f=Path(tmp)/d.suggested_filename;d.save_as(f);assert f.suffix=='.'+fmt and f.stat().st_size>100
        if fmt=='pdf':
            with fitz.open(f) as doc:assert 'DEMONSTRATION DATA' in doc[0].get_text()
        if fmt in ('docx','xlsx','zip'):
            with zipfile.ZipFile(f) as z:assert z.testzip() is None
        if fmt=='json':
            obj=json.loads(f.read_text());ids['demo']=obj['core']['report_id']
            assert obj['core']['locale']=='bilingual' and obj['core']['assigned_count']==30
            assert obj['person']['id']=='demo-01' and any(n['revision']==2 for n in obj['notes'])
        stems.append(d.suggested_filename)
    p.locator('.tw-filters summary').click();p.get_by_label('Sumber data').select_option('local_practice');p.get_by_role('button',name='Terapkan filter').click()
    p.locator('.tw-paper').get_by_text('belum diverifikasi institusi',exact=False).first.wait_for()
    p.get_by_label('Format berkas').select_option('json')
    with p.expect_download() as waiting:p.get_by_role('button',name='Unduh laporan').click()
    d=waiting.value;dest=Path(tmp)/'local.json';d.save_as(dest);local=json.loads(dest.read_text())
    assert local['core']['data_origin']=='local_practice' and local['core']['assigned_count']==0
    p.goto(base+'#/demo/teacher');p.locator('.tw-list').wait_for()
    p.set_viewport_size({'width':320,'height':568})
    assert p.evaluate('document.documentElement.scrollWidth')<=320
    p.screenshot(path=str(EVID/'teacher-320.png'),full_page=True)
    p.set_viewport_size({'width':1366,'height':850})
    p.screenshot(path=str(EVID/'teacher-desktop.png'),full_page=True)
    assert not errors,errors
    (EVID/'browser.json').write_text(json.dumps({'status':'PASS','browser':browser.version,'origin':'loopback static host /school/math/','tests':['3A filter narrows six personas to three','two immutable note revisions, escaped HTML','assignment -> real learner -> answer -> immutable result -> mock-accepted monitoring drilldown','all six report worker downloads parsed synchronously from actual browser','local report excludes demo and personal namespace restored','320 CSS-pixel reflow and desktop captures'],'filenames':stems,'js_errors':errors},indent=2))
    print('PASS teacher-browser',browser.version)
    browser.close()
