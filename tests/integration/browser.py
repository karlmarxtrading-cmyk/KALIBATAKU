"""Exercise the release in a real browser. Python >=3.10, playwright and its Chromium are required."""
import argparse
import json
import os
import sys
from contextlib import ExitStack
from pathlib import Path
from fixture_server import ROOT, fixture_server

SUITES = ('data','performance','layout','journeys','semantics','faults','teacher','offline')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', help='Origin of running fixture_server.py')
    parser.add_argument('--chromium', default=os.environ.get('CHROMIUM_PATH'), help='Installed Chromium binary (Playwright default if absent)')
    parser.add_argument('--suites', nargs='+', choices=SUITES, default=SUITES)
    parser.add_argument('--engine', choices=('chromium','firefox','webkit'),default='chromium')
    parser.add_argument('--headed', action='store_true')
    args = parser.parse_args()
    from playwright.sync_api import sync_playwright
    if args.engine!='chromium':os.environ['KALIBATAKU_QA_ENGINE']=args.engine
    with ExitStack() as stack:
        origin = args.url or stack.enter_context(fixture_server())
        runtime = stack.enter_context(sync_playwright())
        browser = getattr(runtime,args.engine).launch(executable_path=args.chromium if args.engine=='chromium' else None,headless=not args.headed)
        stack.callback(browser.close)
        ctx = browser.new_context(accept_downloads=True,viewport={'width':1366,'height':768},locale='id-ID')
        ctx.set_default_timeout(12_000)
        page = ctx.new_page()
        page.goto(origin.rstrip('/') + '/__qa/integration/')
        failures = []
        for suite in args.suites:
            if suite != 'data':
                with page.expect_popup() as opened:
                    page.locator('[data-suite="'+suite+'"]').click()
                target = opened.value
            else:
                page.locator('[data-suite="'+suite+'"]').click()
                target = None
            page.locator('#out[data-complete="'+suite+'"]').wait_for(timeout=300_000)
            result = json.loads(page.locator('#out').text_content())
            assertions=result.get('checks',[]) + result.get('results',[])
            if not assertions:
                failures.append({'suite':suite,'status':'FAIL','reason':'No assertions executed'})
            failures += [dict(r,suite=suite) for r in assertions if r.get('status')!='PASS']
            if target and not target.is_closed():
                target.close()
        print(json.dumps({'browser':browser.version,'suites':args.suites,'failures': failures},indent=2))
        return 1 if failures else 0

if __name__=='__main__':
    raise SystemExit(main())
