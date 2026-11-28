import sys,zipfile,json,hashlib,shutil,tempfile,subprocess,threading,os
from pathlib import Path
from urllib.request import urlopen
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
root=Path.cwd();archive=Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory(prefix='kalibataku-fresh-') as tmp:
    t=Path(tmp)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None;z.extractall(t);count=len(z.namelist())
    verified=subprocess.check_output(['npm','run','release:verify'],cwd=t,text=True)
    old=json.loads((t/'evidence/deployment/release-manifest.json').read_bytes())['dist_tree_sha256']
    made=subprocess.check_output(['npm','run','build'],cwd=t,text=True);assert old in made
    again=subprocess.check_output(['npm','run','release:verify'],cwd=t,text=True)
    sys.path.insert(0,str(t/'tools'));from preview import make_handler
    srv=ThreadingHTTPServer(('127.0.0.1',0),make_handler(t/'dist','/school/math/'));thread=threading.Thread(target=srv.serve_forever,daemon=True);thread.start()
    from playwright.sync_api import sync_playwright,expect
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'));page=b.new_page();page.goto('http://127.0.0.1:'+str(srv.server_port)+'/school/math/#/session/new?grade=5&level=3&op=ADD&pack=MM-G05-L03-ADD-P001&count=2');page.locator('form.setup button[type=submit]').click()
        eq=page.locator('.app-view:not([aria-busy]) #kp-expression[data-math=svg]');expect(eq).to_have_attribute('data-linear','11/12 + 10/12');page.locator('.kp-answer').fill('21/12');page.locator('[data-submit]').click()
        fb=page.locator('[data-answer-feedback]');expect(fb).to_contain_text('Nilainya sama');expect(fb.locator('[data-math=pending]')).to_have_count(0);assert '7/4' in fb.locator('[data-linear]').evaluate_all('(es)=>es.map(e=>e.dataset.linear)')
        version=b.version;b.close()
    srv.shutdown();srv.server_close()
    rec={'status':'PASS','sha256_zip':hashlib.sha256(archive.read_bytes()).hexdigest(),'bytes':archive.stat().st_size,'members':count,'release_verify_before':verified.strip().splitlines()[-1],'dist_tree_sha256_before_after':old,'release_verify_after':again.strip().splitlines()[-1],'browser':version,'subfolder_smoke':'11/12 + 10/12; raw 21/12 accepted as 7/4; actual SVG','packaging':'Final ZIP extracted and rebuilt in a new temporary directory.'}
    print(json.dumps(rec))
