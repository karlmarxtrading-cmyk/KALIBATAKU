"""Restore the original audit JSON through the UI and download the filtered report."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'tests/integration'))
from fixture_server import fixture_server
fixture=root/'tests/v151/fixtures/timezone-offset-valid-backup.json'
backup=json.loads(fixture.read_bytes())
out=root/'evidence/v151/time';out.mkdir(parents=True,exist_ok=True)
with fixture_server() as origin,sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'));ctx=b.new_context()
    p=ctx.new_page();errors=[];p.on('pageerror',lambda err:errors.append(str(err)))
    base=origin+'/school/math/'
    # Fixed observation date makes the test insensitive to the verification machine's clock.
    p.clock.set_fixed_time(datetime(2026,11,30,12,tzinfo=timezone.utc))
    p.goto(base+'#/profiles');p.locator('input[type=file]').set_input_files(str(fixture))
    p.get_by_role('button',name=re.compile('^Pulihkan ke profil')).click()
    expect(p.locator('main')).to_contain_text('Pemulihan selesai',timeout=15000)
    p.reload()
    pick=p.locator('main select').first
    pick.select_option(backup['profile']['id'])
    p.locator('[data-switch-profile]').click()
    expect(p.locator('.profile-control strong')).to_have_text(backup['profile']['name'])
    p.goto(base+'#/reports?source=local_practice')
    p.locator('.tw-paper[data-report-id]').wait_for()
    p.locator('.tw-filters summary').click()
    p.get_by_label('Mulai tanggal',exact=True).fill('2026-11-28');p.get_by_label('Sampai tanggal',exact=True).fill('2026-11-28')
    p.get_by_label('Zona waktu',exact=True).select_option('Asia/Jakarta')
    p.get_by_role('button',name='Terapkan filter').click()
    expect(p.locator('.tw-paper')).to_contain_text('Sesi selesai dalam periode ini: 4')
    expect(p.locator('.tw-paper')).to_contain_text('Misi dalam periode 3')
    p.get_by_label('Format berkas',exact=True).select_option('json')
    with p.expect_download() as download:p.get_by_role('button',name='Unduh laporan').click()
    target=out/'browser-report.json';download.value.save_as(str(target))
    s=json.loads(target.read_bytes());assert s['person']['id']==backup['profile']['id']
    assert (s['completed'],s['core']['assigned_count'],s['core']['correct_count'],s['journey']['missions'])==(4,32,32,3)
    assert (s['core']['period_start_utc'],s['core']['period_end_exclusive_utc'])==('2026-11-27T17:00:00.000Z','2026-11-28T17:00:00.000Z')
    assert [a['started'] for a in s['sessions']]==[a['data']['started_at'] for a in reversed(backup['records']['attempts'])]
    assert not errors,errors
    release=json.loads((root/'dist/offline-assets.json').read_bytes())['release']
    (out/'browser.json').write_text(json.dumps({'status':'PASS','engine':'Chromium '+b.version,'release':release,
        'fixture_sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'report_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
        'method':'Synthetic profile restored through file picker to IndexedDB, page reloaded, profile selected, date controls applied, report downloaded through actual export worker.',
        'completed':s['completed'],'assigned':s['counts']['N'],'missions':s['journey']['missions'],'retained_offset':True,
        'page_errors':errors},indent=2)+'\n')
    ctx.close();b.close()
print('PASS AUD15-03 browser restore, reload, date filtering and download')
