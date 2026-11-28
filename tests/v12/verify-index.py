from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[2]
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'));p=b.new_page()
    p.goto((root/'evidence/00_HASIL_UJI.html').as_uri())
    expect(p.locator('#count')).to_have_text('194 baris ditampilkan');p.locator('#query').fill('FM-018')
    expect(p.locator('details:visible')).to_have_count(1);p.locator('details:visible summary').click()
    assert p.locator('details[open] li a').count()>0
    p.locator('#query').fill('');p.locator('#filter').select_option('NOT_RUN')
    assert p.locator('details:visible').count()>0
    data={'status':'PASS','engine':b.version,'initial_rows':194,'query':'FM-018','filter':'NOT_RUN','matched_rows':p.locator('details:visible').count()}
    (root/'evidence/v12/evidence-guide.json').write_text(json.dumps(data,indent=2));b.close()
