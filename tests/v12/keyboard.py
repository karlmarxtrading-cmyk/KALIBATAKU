import json,os,sys
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'tests/integration'))
from fixture_server import fixture_server
with fixture_server() as origin,sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'));p=b.new_page()
    p.goto(origin+'/__qa/integration/keyboard.html')
    with p.expect_popup() as popup:p.locator('#open').click()
    w=popup.value;expect(p.locator('#out')).to_have_text('Ready for keyboard input.');w.locator('.app-view:not([aria-busy]) #kp-answer').wait_for()
    w.keyboard.press('Tab');w.keyboard.press('Shift+Tab');expect(w.locator('.kp-answer')).to_be_focused();w.keyboard.type('5');w.keyboard.press('Enter');w.locator('[data-answer-feedback]').wait_for();w.keyboard.press('Enter')
    def select(selector):
        for n in range(80):
            if w.locator(selector).evaluate("e=>document.activeElement===e"):return
            w.keyboard.press('Tab')
        raise AssertionError(selector)
    expect(w.locator('#kp-question-position')).to_contain_text('2 dari 2')
    expect(w.locator('.kp-answer')).to_be_focused();w.keyboard.type('4');w.keyboard.press('Enter')
    # 1.4 (UX-02 / AC:UX-05): on the last practice question the same Next control reads
    # 'Lihat hasil' and finalises once; the 1.3 review grid + submit step is gone for practice.
    expect(w.locator('[data-part=next]')).to_contain_text('Lihat hasil');w.keyboard.press('Enter');expect(w.locator('.kp-lead')).to_contain_text('2 dari 2')
    p.locator('#collect').click();d=json.loads(p.locator('#out').text_content());assert d['trustedKeystrokes']>=8 and '2 dari 2' in d['finalVisible']
    (root/'evidence/ux/acceptance/keyboard.json').write_text(json.dumps(d,indent=2));b.close()
