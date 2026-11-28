"""Read a full frozen G12 expression after Next on an actual 320px CSS viewport."""
import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tests/v161'))
from viewport import TestOrigin, fresh, sync_playwright, expect, state, answer, command, question


def inspect(browser, url):
    with fresh(browser, (320, 568)) as page:
        page.goto(url + '#/session/new?grade=12&level=5&op=MIX&pack=MM-G12-L05-MIX-P001&count=3&mode=practice')
        page.locator('form.setup button[type=submit]').click()
        expect(page.locator('#kp-answer')).to_be_focused()
        answer(page, state(page), 'incorrect')
        command(page, 'click')
        rows = []
        question(rows, page, 'long-next', 1)
        expr = page.locator('#kp-expression')
        metrics = expr.evaluate("""el=>({
            clientWidth:el.clientWidth, scrollWidth:el.scrollWidth, clientHeight:el.clientHeight,
            scrollHeight:el.scrollHeight, tabIndex:el.tabIndex, cssFont:getComputedStyle(el).fontSize,
            overflowX:getComputedStyle(el).overflowX, svgRuns:el.querySelectorAll('svg').length,
            name:el.getAttribute('aria-label'), linear:el.dataset.linear
        })""")
        passes = (rows[0]['status'] == 'PASS' and metrics['svgRuns'] > 0 and metrics['name']
                  and len(metrics['linear']) > 20 and float(metrics['cssFont'][:-2]) >= 24
                  and metrics['scrollHeight'] <= metrics['clientHeight'] + 2)
        if metrics['scrollWidth'] > metrics['clientWidth'] + 2:
            expr.focus()
            page.keyboard.press('ArrowRight')
            page.wait_for_function("document.querySelector('#kp-expression').scrollLeft > 0")
            metrics['afterArrow'] = expr.evaluate('el=>el.scrollLeft')
            metrics['lastReachable'] = expr.evaluate("""el=>{
                el.scrollTo({left:el.scrollWidth,behavior:'instant'});
                return el.scrollLeft+el.clientWidth >= el.scrollWidth-2;
            }""")
            passes = passes and metrics['tabIndex'] == 0 and metrics['lastReachable']
        return {'status': 'PASS' if passes else 'FAIL', 'metrics': metrics, 'geometry': rows[0]['actual']}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--dist', type=Path, required=True)
    cli.add_argument('--out', type=Path, required=True)
    args = cli.parse_args()
    output = {'offline_release':json.loads((args.dist/'offline-assets.json').read_bytes())['release'], 'browsers':{}}
    origin = TestOrigin(args.dist)
    try:
        with sync_playwright() as pw:
            for engine in ('chromium', 'firefox', 'webkit'):
                exe = os.environ.get('CHROMIUM_PATH') if engine == 'chromium' else None
                browser = getattr(pw, engine).launch(executable_path=exe)
                try:
                    output['browsers'][engine] = inspect(browser, origin.url)
                except Exception as err:
                    output['browsers'][engine] = {'status':'FAIL', 'error':str(err)}
                finally:
                    output['browsers'][engine]['version'] = browser.version
                    browser.close()
    finally:
        origin.close()
    args.out.write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n',encoding='utf-8')
    return int(any(run['status'] != 'PASS' for run in output['browsers'].values()))


if __name__ == '__main__':
    raise SystemExit(main())
