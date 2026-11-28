"""Exercise fresh Enter after text commit and the separate IME-accepting key lifetime."""
import argparse
import asyncio
import json
import os
import platform
from pathlib import Path

from playwright.async_api import async_playwright, expect

from viewport import FEEDBACK, FIELD, HOME, ROOT, STATE, TestOrigin, now, record


TRACE = """
window.compositionTrace = [];
for (const type of ['compositionstart','compositionend','input','keydown','keyup','submit']) {
  window.addEventListener(type, event => {
    const target = event.target;
    window.compositionTrace.push({
      type, at:performance.now(), value:target.value, key:event.key, code:event.code,
      keyCode:event.keyCode, repeat:event.repeat, composing:event.isComposing,
      inputType:event.inputType, trusted:event.isTrusted
    });
  }, true);
}
"""

# Some orders cannot be made deterministic with a physical key source. Dispatch
# these public DOM events within one task, before a zero-delay timer can run.
SCRIPTED = """mode => {
  const input = document.querySelector('#kp-answer');
  function key(type, opts={}) {
    return input.dispatchEvent(new KeyboardEvent(type, {
      bubbles:true, cancelable:true, key:'Enter', code:'Enter', keyCode:13, ...opts
    }));
  }
  function compose(type) {
    input.dispatchEvent(new CompositionEvent(type,{bubbles:true,data:'81'}));
  }
  function commit() {
    input.value='81';
    input.dispatchEvent(new InputEvent('input',{
      bubbles:true,inputType:'insertCompositionText',data:'81',isComposing:false
    }));
  }
  if (mode==='candidate') {
    compose('compositionstart');
    key('keydown',{isComposing:true,keyCode:229});
    input.form.requestSubmit();
    compose('compositionend');
    commit();
    // Form implementations can deliver implicit submit while the same IME
    // acceptance key is down, even though the new value is already present.
    input.form.requestSubmit();
    key('keydown',{repeat:true});
    key('keyup');
  } else if (mode==='229' || mode==='flagged') {
    key('keydown',mode==='229'?{keyCode:229}:{isComposing:true});
    key('keyup');
  } else {
    // No candidate-accepting Enter is down. This new key must grade even if
    // the browser has not yet executed the next timer task.
    compose('compositionstart');
    compose('compositionend');
    commit();
    key('keydown');
    key('keyup');
  }
}"""


async def begin(page, url):
    await page.goto(url)
    await page.locator(HOME).click()
    await expect(page.locator(FIELD)).to_be_focused()


async def observed(page):
    data = await page.evaluate(STATE, None)
    return {
        'index': data['index'],
        'gradeEvents': data['grades'],
        'completionEvents': data['completions'],
        'history': data['history'],
        'focus': await page.evaluate('document.activeElement.id'),
        'trace': await page.evaluate('window.compositionTrace'),
    }


async def trusted_commits(page, rows, engine):
    for index in range(4):
        value = str(71 + index)
        label = f'{engine}-native-{index + 1}'
        await page.evaluate('window.compositionTrace=[]')
        # The two native automation commands are issued back to back. The
        # recorded trusted events establish their actual order in each engine.
        await asyncio.gather(page.keyboard.insert_text(value), page.keyboard.press('Enter'))
        error = None
        try:
            await expect(page.locator(FEEDBACK)).to_be_focused()
        except AssertionError as exc:
            error = str(exc).splitlines()[0]
        data = await observed(page)
        trace = data['trace']
        input_index = next((i for i,e in enumerate(trace) if e['type']=='input' and
                            e['trusted'] and e.get('value')==value), None)
        key_index = next((i for i,e in enumerate(trace) if e['type']=='keydown' and
                          e['trusted'] and e.get('key')=='Enter' and not e.get('repeat')), None)
        ordered = input_index is not None and key_index is not None and input_index < key_index
        if engine == 'firefox':
            ordered = ordered and any(e['type']=='compositionend' and e['trusted'] for e in trace[:key_index])
        passed = (not error and ordered and data['gradeEvents']==index+1 and data['index']==index
                  and len(data['history'])==1 and data['completionEvents']==0)
        if error:
            data['observation'] = error
        record(rows,label+'-grade',passed,'Committed trusted text then one fresh Enter yields one grade',data)
        if not passed:
            return
        await page.keyboard.press('Enter')
        await expect(page.locator(FIELD)).to_be_focused()
        data = await observed(page)
        record(rows,label+'-next',data['index']==index+1 and data['gradeEvents']==index+1
               and not data['history'] and data['completionEvents']==0,
               'The next new Enter advances one index with no extra grade',data)


async def controlled_order(page, rows, engine):
    field = page.locator(FIELD)
    await field.fill('81')
    for mode in ('candidate','229','flagged'):
        await page.evaluate('window.compositionTrace=[]')
        await page.evaluate(SCRIPTED, mode)
        # Allow promise work from a mistaken submit to reach the real store.
        await page.evaluate('() => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        data = await observed(page)
        valid = (data['gradeEvents']==0 and data['index']==0 and data['history']==[]
                 and data['focus']=='kp-answer' and not await page.locator(FEEDBACK).count())
        record(rows,engine+'-'+mode,valid,'IME acceptance, implicit submit or IME-marked Enter leaves the item ungraded',data)
    await page.evaluate('window.compositionTrace=[]')
    await page.evaluate(SCRIPTED,'fresh')
    error = None
    try:
        await expect(page.locator(FEEDBACK)).to_be_focused()
    except AssertionError as exc:
        error = str(exc).splitlines()[0]
    data = await observed(page)
    if error:
        data['observation'] = error
    valid = not error and data['index']==0 and data['gradeEvents']==1 and len(data['history'])==1
    record(rows,engine+'-fresh-before-timer',valid,'A fresh Enter after end plus final input grades in the same task',data)
    if not valid:
        return
    await page.keyboard.down('Enter')
    await expect(field).to_be_focused()
    await page.keyboard.down('Enter')
    await page.keyboard.up('Enter')
    data = await observed(page)
    record(rows,engine+'-held-next',data['index']==1 and data['gradeEvents']==1
           and not data['history'] and await field.get_attribute('aria-invalid')!='true',
           'A new key advances once, its held repeat and release leave the new item untouched',data)


async def run(args):
    release = json.loads((args.dist/'offline-assets.json').read_bytes())['release']
    checks = []
    runtime = {'python': platform.python_version(), 'os': platform.platform(), 'browsers': {}}
    receipt = {'schema':'kalibataku-qa-receipt/1','suite':'compose-commit','started':now(),
               'build':{'offline_release':release},'runtime':runtime,'checks':checks,
               'scope':'Desktop browser input events and controlled DOM event sequences. Physical IMEs require device evidence.'}
    origin = TestOrigin(args.dist)
    try:
        async with async_playwright() as pw:
            for engine in ('chromium','firefox','webkit'):
                executable = os.environ.get('CHROMIUM_PATH') if engine=='chromium' else None
                browser = await getattr(pw,engine).launch(executable_path=executable)
                runtime['browsers'][engine] = browser.version
                try:
                    for scenario in (trusted_commits,controlled_order):
                        ctx = await browser.new_context(viewport={'width':390,'height':844})
                        try:
                            await ctx.add_init_script(TRACE)
                            page = await ctx.new_page()
                            await begin(page,origin.url)
                            await scenario(page,checks,engine)
                        except Exception as exc:
                            record(checks,engine+'-'+scenario.__name__+'-execution',False,
                                   'Complete the browser scenario with the actual store',str(exc)[:1800])
                        finally:
                            await ctx.close()
                finally:
                    await browser.close()
    finally:
        origin.close()
    failed = [row['id'] for row in checks if row['status']!='PASS']
    receipt.update(finished=now(),status='FAIL' if failed else 'PASS',assertions=len(checks))
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(f"compose-commit: {len(checks)-len(failed)}/{len(checks)} PASS, failed={failed}")
    return int(bool(failed))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist',type=Path,default=ROOT/'dist')
    parser.add_argument('--out',type=Path,required=True)
    raise SystemExit(asyncio.run(run(parser.parse_args())))
