import os, sys, json, argparse
from pathlib import Path
from threading import Thread
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'tests/integration'))
from ux_server import Review
parser=argparse.ArgumentParser();parser.add_argument('suites',nargs='*',default=['shell','school','player','data','visual','reflow']);args=parser.parse_args()
with ThreadingHTTPServer(('127.0.0.1',0),Review) as srv,sync_playwright() as p:
 srv.baseline=None;srv.guide=None;Thread(target=srv.serve_forever,daemon=True).start()
 origin='http://127.0.0.1:'+str(srv.server_port)
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'));failures=[]
 for case in args.suites:
  with b.new_context(viewport={'width':1366,'height':880}) as ctx:
   page=ctx.new_page();page.goto(origin+('/__qa/perf/lab.html' if case=='perf' else '/__qa/integration/data-ux.html' if case=='data' else '/'))
   with page.expect_response(lambda r:r.url.endswith('/__qa/ux-receipt') and r.request.method=='POST',timeout=230000):
    page.locator('#run' if case in ('data','perf') else f'[data-run="{case}-ux"]').click()
   path=root/f'evidence/ux/acceptance/browser-{case}-ux.json';d=json.loads(path.read_bytes());bad=[(r['id'],r.get('actual',r.get('error'))) for r in d.get('checks',[]) if r['status']!='PASS'];print(case,d.get('error'),bad,flush=True)
   empty=(not d.get('runs')) if case=='perf' else (not d.get('checks'))
   if d.get('error') or d.get('errors') or bad or empty:failures.append(case)
 b.close()
print('extended suites',args.suites,'failed',failures,flush=True)
sys.exit(1 if failures else 0)
