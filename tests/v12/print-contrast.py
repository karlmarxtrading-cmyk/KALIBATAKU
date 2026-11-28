"""Inspect published styles and printed output on an actual Chromium page with synthetic records."""
import json, os, sys
from pathlib import Path
import fitz
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'tests/integration'))
from fixture_server import fixture_server
out=root/'evidence/v12';rows=[]
with fixture_server() as origin,sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'));p=b.new_page()
    for lang in ['id','en']:
        p.goto(origin+'/school/math/#/reports?source=demo');p.locator('.tw-paper[data-report-id]').wait_for()
        p.evaluate("""async lang=>{
            document.documentElement.dataset.theme='dark';const {drawReports}=await import('./teacher/reports-view.js'),{initialFilters}=await import('./teacher/report.js'),{syntheticSessions,roster}=await import('./teacher/demo.js');
            const {default:pkg}=await import('./bank/v1.2/g05/l03/MM-G05-L03-ADD-P001.mjs');
            const a=structuredClone(syntheticSessions().find(x=>x.package_id==='DEMO-FIXTURE-HELP-1')),person=roster.find(r=>r.id===a.profile_id);
            a.items[0].question=pkg.questions[0];a.items[0].history=[{raw_answer:'99',draft_locale:'id',is_correct:false,answer:{numerator:'99',denominator:'1'}},{raw_answer:'21/12',draft_locale:'id',is_correct:true,key_seen_before:true,answer:{numerator:'7',denominator:'4'}}];
            const attempts=Array.from({length:64},(_,i)=>({...a,attempt_id:'PRINT-'+(i+1),package_id:'QA-'+(i+1)}));
            const main=document.querySelector('main');main.replaceChildren();const page=document.createElement('div');page.className='tw';main.append(page);
            drawReports({page,data:{people:[person],attempts,notes:[]},l:lang,t:(id,en)=>lang==='id'?id:en,filter:initialFilters(),memory:{locale:lang,appendix:true},reportKey:'print-'+lang,status:document.createElement('p'),ctx:{signal:new AbortController().signal}});
        }""",lang)
        paper=p.locator('.tw-paper[data-report-id]');paper.wait_for();p.emulate_media(media='print')
        p.evaluate('document.fonts.ready')
        palette=paper.evaluate("e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color})")
        assert palette['background']=='rgb(255, 255, 255)',palette
        dest=out/'reports'/('cetak-'+lang+'.pdf');dest.parent.mkdir(parents=True,exist_ok=True);p.pdf(path=dest,format='A4',print_background=True,margin=dict(top='12mm',bottom='12mm',left='12mm',right='12mm'))
        with fitz.open(dest) as pdf:
            pages=[pg.get_text() for pg in pdf];text=' '.join(pages);assert len(pages)>=2 and all(x in text for x in ['11/12 + 10/12','7/4','21/12']),text[:900]
            bounds=[]
            for pg in pdf:
                pix=pg.get_pixmap(matrix=fitz.Matrix(.5,.5));assert sum(pix.samples)/len(pix.samples)<254.99
                corners=[pix.pixel(x,y)[:3] for x,y in ((3,3),(pix.width-4,3),(3,pix.height-4),(pix.width-4,pix.height-4))]
                assert all(min(rgb)>=250 for rgb in corners),(lang,pg.number+1,'page outside report must be white',corners)
                words=pg.get_text('words')
                assert words,(lang,pg.number+1,'empty printed page')
                assert all(0<=w[0]<w[2]<=pg.rect.width+1 and 0<=w[1]<w[3]<=pg.rect.height+1 for w in words),(lang,pg.number+1,'word outside page')

                bounds.append([min(w[1] for w in words),max(w[3] for w in words),len(words)])
            rows.append({'language':lang,'method':'Browser print from dark screen theme, real report preview and 64 synthetic sessions','paper':palette,'pages':len(pdf),'page_bounds':bounds,'white_print_margins_on_every_page':True,'fraction_and_key':True,'source':paper.get_attribute('data-origin')})
        p.emulate_media(media='screen')
    p.goto(origin+'/school/math/#/session/new?grade=5&level=3&op=ADD&count=2');p.locator('form.setup button[type=submit]').click();p.locator('.app-view:not([aria-busy]) .kp-answer').fill('21/12');p.locator('[data-submit]').click();p.locator('[data-answer-feedback] svg').first.wait_for()
    colors=[]
    for theme in ['light','dark']:
        p.evaluate("v=>document.documentElement.dataset.theme=v",theme)
        nextbtn=p.locator('[data-part=next]');nextbtn.focus();nextbtn.press('Tab');p.keyboard.press('Shift+Tab')
        data=p.evaluate(r"""()=>{const rgb=v=>v.match(/[\d.]+/g).slice(0,3).map(Number);
        function bg(el){for(;el;el=el.parentElement){let c=getComputedStyle(el).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent')return c;}return 'rgb(255,255,255)';}
        const luminance=c=>rgb(c).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
        const ratio=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
        const out=[];for(const sel of ['[data-answer-feedback] h2','[data-answer-feedback] dt','[data-answer-feedback] dd','[data-answer-feedback] summary','[data-part=next]','#kp-expression svg','[data-mml-node=mfrac] rect','header a[href]']){
          const e=[...document.querySelectorAll(sel)].find(x=>x.getBoundingClientRect().width);if(!e)continue;const s=getComputedStyle(e),back=bg(e);out.push({selector:sel,fg:s.color,bg:back,ratio:ratio(s.color,back)});}
        const n=document.querySelector('[data-part=next]'),ns=getComputedStyle(n),back=bg(n.parentElement);
        out.push({selector:'keyboard focus',fg:ns.outlineColor,bg:back,ratio:ratio(ns.outlineColor,back)});return out;}""")
        colors.append({'theme':theme,'samples':data})
    for group in colors:
        for pair in group['samples']:assert pair['ratio']>=(3 if pair['selector']=='keyboard focus' else 4.5),(group['theme'],pair)
    result={'status':'PASS','engine':b.version,'build':json.loads((root/'dist/offline-assets.json').read_bytes())['release'],'print':rows,'contrast':colors}
    (out/'print-contrast.json').write_text(json.dumps(result,indent=2));b.close()
