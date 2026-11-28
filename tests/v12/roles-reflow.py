import json,os,sys
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'tests/integration'))
from fixture_server import fixture_server
rows=[]
with fixture_server() as origin,sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'));p=b.new_page()
    for route in ['demo/teacher','demo/student/demo-04','demo/admin','reports?source=local_practice','history']:
        p.goto(origin+'/school/math/#/'+route);p.locator('main .app-view:not([aria-busy]) h1').wait_for()
        for lang in ['id','en']:
            if p.locator('html').get_attribute('lang')!=lang:
                p.locator('[data-action=language]').click();expect(p.locator('html')).to_have_attribute('lang',lang)
                p.locator('main .app-view:not([aria-busy]) h1').wait_for()
            for theme in ['light','dark']:
                p.evaluate('t=>document.documentElement.dataset.theme=t',theme)
                for width in [320,360,390,768,1024,1440]:
                    p.set_viewport_size(dict(width=width,height=780 if width<=390 else 670))
                    p.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
                    for zoom in [100,200]:
                        v=p.evaluate("""zoom=>{document.documentElement.style.fontSize=zoom+'%';const h=document.documentElement;return {scroll:h.scrollWidth,viewport:h.clientWidth,innerWidth:innerWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().right>h.clientWidth+2).slice(0,8).map(e=>e.tagName+' '+e.className+' '+e.textContent.trim().slice(0,25))};}""",zoom)
                        assert v['scroll']<=v['viewport']+2 and v['innerWidth']==width,(route,lang,theme,width,zoom,v)
                        rows.append(dict(page=route,lang=lang,theme=theme,width=width,text_percent=zoom,method='live window',**v))
                p.evaluate("document.documentElement.style.fontSize='100%'")
    (root/'evidence/v12/roles-reflow.json').write_text(json.dumps({'status':'PASS','browser':b.version,'build':json.loads((root/'dist/offline-assets.json').read_bytes())['release'],'samples':rows},indent=2));b.close()
