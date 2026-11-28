"""Measure real learner transitions without scrolling the page on behalf of the learner.

Accepts an extracted dist for read-only comparisons. Each matrix row starts with a
new local profile. Locale, browser geometry, events and stored histories are observed
from the rendered application. Touch is a browser automation input; OS IMEs are
covered by the separate device protocol.
"""
import argparse
import hashlib
import json
import os
import platform
import sys
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import partial
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Event

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests/journey"))
from map_native_zoom import set_site_zoom
from offline_origin import TestOrigin

FIELD = "#kp-answer"
FEEDBACK = "[data-answer-feedback]"
NEXT = "[data-part=next]"
HOME = "[data-cta=adventure]"
TARGETS = {"position":"#kp-question-position", "expression":"#kp-expression", "input":FIELD}
SIZES = [(320,568), (390,844), (844,390), (1280,800)]
MODIFIERS = ["Shift", "Control", "Alt", "Meta"]

# Wait for actual rendering work; no focus(), scrollIntoView(), fill() or locator
# screenshot between the navigation and the sample. Those could conceal the defect.
MEASURE = """async selectors => {
  const expr = document.querySelector('#kp-expression');
  if (expr?.mathReady) await expr.mathReady;
  await document.fonts.ready;
  for(let i=0;i<3;i++) await new Promise(resolve=>requestAnimationFrame(resolve));
  const vp=window.visualViewport;
  const left=vp?.offsetLeft ?? 0, top=vp?.offsetTop ?? 0;
  const width=vp?.width ?? innerWidth, height=vp?.height ?? innerHeight;
  const rects={};
  for(const [name,selector] of Object.entries(selectors)){
    const el=document.querySelector(selector);
    if(!el){rects[name]=null;continue;}
    const r=el.getBoundingClientRect(), cx=(r.left+r.right)/2, cy=(r.top+r.bottom)/2;
    const hit=document.elementFromPoint(cx,cy);
    rects[name]={left:r.left,top:r.top,right:r.right,bottom:r.bottom,
      visible:r.width>0 && r.height>0 && r.left>=left-1 && r.top>=top-1 &&
        r.right<=left+width+1 && r.bottom<=top+height+1,
      hit:hit===el || el.contains(hit), text:el.innerText?.slice(0,110)};
  }
  const field=document.querySelector('#kp-answer');
  return {viewport:{left,top,width,height,scale:vp?.scale??1},
    layout:[innerWidth,innerHeight],scroll:[scrollX,scrollY],
    documentWidth:document.documentElement.scrollWidth,rects,
    math:expr?.dataset.math,linear:expr?.dataset.linear,
    editable:!!field && !field.disabled && !field.readOnly && !field.closest('fieldset:disabled,[inert]'),
    focus:document.activeElement?.id,lang:document.documentElement.lang};
}"""
STATE = """async supplied => {
  const store=await import('./data/store.js'),scope=store.activeScope();
  const id=supplied||decodeURIComponent(location.hash.split('/').at(-1));
  const a=await store.getAttempt(id,scope);
  const ev=await store.listEvents(id,scope);
  const current=a.items[a.index];
  return {id:a.attempt_id,index:a.index,count:a.items.length,status:a.status,
    fp:current.question.fingerprint, key:current.question.answer, raw:current.draft,
    history:current.history.map(h=>({correct:h.is_correct,assisted:!!h.key_seen_before})),
    grades:ev.filter(e=>e.event_type==='answer.submitted').length,
    completions:ev.filter(e=>e.event_type==='attempt.completed').length};
}"""


def now():
    return datetime.now(timezone.utc).isoformat()


def state(page, attempt=None):
    return page.evaluate(STATE, attempt)


def record(rows, label, passed, expected, actual):
    rows.append(dict(id=label,status="PASS" if passed else "FAIL",expected=expected,actual=actual))


def command(page, method):
    if method == "enter":
        page.keyboard.down("Enter")
        page.keyboard.up("Enter")
    elif method == "click":
        page.locator(NEXT).click()
    else:
        page.locator(NEXT).tap()


def question(rows, page, label, expected_index):
    expect(page.locator(FIELD)).to_be_focused()
    geometry=page.evaluate(MEASURE, TARGETS)
    boxes=geometry["rects"]
    fits=all(box and box["visible"] and box["hit"] for box in boxes.values())
    position=boxes["position"]["text"] if boxes["position"] else ""
    start=(f"Question {expected_index+1} of " if geometry["lang"]=="en" else f"Soal {expected_index+1} dari ")
    record(rows,label,fits and geometry["editable"] and geometry["focus"]=="kp-answer"
           and geometry["math"]=="svg" and geometry["documentWidth"]<=geometry["layout"][0]+1
           and position.startswith(start),
           "Position, rendered expression and focused editable field are in the unobstructed visual viewport",geometry)


def start_home(page, url, rows, label, check_cta=True):
    page.goto(url)
    cta=page.locator(HOME)
    cta.wait_for()
    if check_cta:
        geom=page.evaluate(MEASURE, {"start":HOME})
        box=geom["rects"]["start"]
        record(rows,label+"-home",box["visible"] and box["hit"],
               "Fresh learner can see and activate the primary action without manually scrolling",geom)
    cta.click()
    question(rows,page,label+"-initial",0)


def answer(page, current, outcome):
    val=current["key"]
    n,d=int(val["numerator"]),int(val["denominator"])
    if outcome=="incorrect":
        text=str(n+1) if d==1 else f"{n+d}/{d}"
    elif outcome=="equivalent":
        text=f"{n*2}/{d*2}"
    else:
        text=str(n) if d==1 else f"{n}/{d}"
    page.locator(FIELD).fill(text)
    command(page,"enter")
    expect(page.locator(FEEDBACK)).to_be_focused()
    expect(page.locator(FEEDBACK)).to_have_attribute("data-state",outcome)


def transition(page, rows, label, outcome, method, screenshot=None):
    before=state(page)
    answer(page,before,outcome)
    graded=state(page)
    command(page,method)
    question(rows,page,label+"-next",before["index"]+1)
    if screenshot is not None:
        raw=page.screenshot(path=screenshot)
        rows[-1]["actual"]["screenshot"]={"file":screenshot.name,"sha256":hashlib.sha256(raw).hexdigest()}
    after=state(page)
    # Use trusted key events without refocusing the field first.
    page.keyboard.type("7")
    expect(page.locator(FIELD)).to_have_value("7")
    record(rows,label+"-ledger",graded["index"]==before["index"] and
           graded["grades"]==before["grades"]+1 and after["id"]==before["id"] and
           after["index"]==before["index"]+1 and after["grades"]==graded["grades"] and
           after["history"]==[] and after["completions"]==0,
           "One grade at the original index, one advance, and typed input reaches the new unanswered item",
           {"id":before["id"],"indices":[before["index"],graded["index"],after["index"]],
            "grade_events":[before["grades"],graded["grades"],after["grades"]],"typed":"7",
            "next_fingerprint":after["fp"],"completions":after["completions"]})


@contextmanager
def fresh(browser,size):
    ctx=browser.new_context(viewport={"width":size[0],"height":size[1]},has_touch=True,reduced_motion="reduce")
    try:
        yield ctx.new_page()
    finally:
        ctx.close()


def matrix(browser,url,rows,pictures,engine):
    for size in SIZES:
        for method in ["enter","click","touch"]:
            label=f"{size[0]}x{size[1]}-{method}"
            with fresh(browser,size) as page:
                try:
                    start_home(page,url,rows,label)
                    for outcome in ["correct","incorrect","equivalent"]:
                        capture=method=="enter" and outcome=="correct" and size in [(320,568),(844,390)]
                        picture=pictures/f"{engine}-{label}-next.png" if capture else None
                        transition(page,rows,label+"-"+outcome,outcome,method,picture)
                except Exception as ex:
                    record(rows,label+"-execution",False,"Complete all transitions in this browser context",str(ex)[:1700])


def modifier_boundary(page,rows,label,selector,expected_id):
    # A false submit could destroy the control. Record it before returning and
    # let a fresh scenario cover the following state.
    for mod in MODIFIERS:
        control=page.locator(selector)
        control.focus()
        before=state(page,expected_id)
        route=page.url
        page.keyboard.press(mod+"+Enter")
        # Store reads observe committed writes, including an event arriving after
        # a handler returns. Two animation frames allow native submit/navigation.
        page.evaluate("()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
        after=state(page,expected_id)
        same=route==page.url and before==after and control.count()==1
        record(rows,label+"-"+mod,same,"Modified Enter on the command target leaves the attempt and route unchanged",
               {"before":[before["index"],before["grades"]],"after":[after["index"],after["grades"]],
                "sameRoute":route==page.url,"control":selector})
        if not same:
            return False
    return True


def shortcuts(browser,url,rows):
    with fresh(browser,(390,844)) as page:
        start_home(page,url,rows,"modifiers")
        page.locator(FIELD).fill("999")
        # Wait for the ordinary autosave so draft changes cannot be mistaken for a grade.
        expect(page.locator(".kp-question > .kp-row:last-child small").first).to_contain_text("Tersimpan")
        aid=state(page)["id"]
        if not modifier_boundary(page,rows,"modifier-input",FIELD,aid):
            return
        modifier_boundary(page,rows,"modifier-check","[data-submit]",aid)
        page.locator(FIELD).focus()
        command(page,"enter");expect(page.locator(FEEDBACK)).to_be_focused()
        if not modifier_boundary(page,rows,"modifier-feedback",FEEDBACK,aid):
            return
        modifier_boundary(page,rows,"modifier-next",NEXT,aid)
        summary=page.locator(".verdict-steps summary")
        summary.focus()
        command(page,"enter")
        expect(page.locator(".verdict-steps")).to_have_attribute("open","")
        record(rows,"secondary-enter",state(page)["grades"]==1 and state(page)["index"]==0,
               "Native Enter expands solution steps without advancing the attempt",{"open":True})


def continuity(browser,url,rows):
    with fresh(browser,(844,390)) as page:
        start_home(page,url,rows,"continuity")
        before=state(page)
        aid=before["id"]
        answer(page,before,"incorrect")
        page.locator("[data-part=revise]").click()
        question(rows,page,"revision-viewport",0)
        answer(page,state(page),"correct")
        page.reload()
        expect(page.locator(FEEDBACK)).to_be_focused()
        restored=state(page)
        command(page,"enter")
        question(rows,page,"resume-feedback-next",1)
        record(rows,"revision-resume-ledger",restored["id"]==aid and restored["history"]==[
            {"correct":False,"assisted":False},{"correct":True,"assisted":True}] and restored["grades"]==2,
            "Reload retains one wrong first submission and one assisted revision",restored)
        page.locator(FIELD).fill("37")
        expect(page.locator(".kp-question > .kp-row:last-child small").first).to_contain_text("Tersimpan")
        page.reload()
        question(rows,page,"resume-draft-viewport",1)
        expect(page.locator(FIELD)).to_have_value("37")
        for i in range(1,before["count"]):
            answer(page,state(page),"correct")
            command(page,"enter")
            if i+1<before["count"]:
                expect(page.locator(FIELD)).to_be_focused()
        expect(page.locator(".mission-result")).to_be_visible()
        expect(page.locator("main h1")).to_be_focused()
        result_ok=modifier_boundary(page,rows,"modifier-result-heading","main h1",aid)
        if result_ok:
            result_ok=modifier_boundary(page,rows,"modifier-result-cta","[data-part=next-mission]",aid)
        if result_ok:
            page.locator("main h1").focus()
            command(page,"enter")
            question(rows,page,"next-mission-viewport",0)
            old,new=state(page,aid),state(page)
            total=page.evaluate("async()=>{const s=await import('./data/store.js');return (await s.listAttempts(s.activeScope())).length}")
            record(rows,"between-mission-ledger",old["completions"]==1 and total==2 and new["id"]!=aid and
                   new["index"]==0 and new["grades"]==0,"One finalization and one new unanswered attempt",
                   {"attempts":total,"completion_events":old["completions"],"new_id":new["id"],"grades":new["grades"]})


def long_expression(browser,url,rows):
    with fresh(browser,(320,568)) as page:
        pack="MM-G12-L05-MIX-P001"
        page.goto(url+f"#/session/new?grade=12&level=5&op=MIX&pack={pack}&count=3&mode=practice")
        shuffle=page.locator("[name=shuffle]")
        if shuffle.count() and shuffle.is_checked():shuffle.uncheck()
        page.locator("form.setup button[type=submit]").click()
        question(rows,page,"long-initial",0)
        transition(page,rows,"long-fraction","incorrect","click")
        geom=page.evaluate(MEASURE,TARGETS)
        record(rows,"long-real-content",len(geom["linear"])>=20,
               "The selected real-bank second question contains a multi-operation expression",
               {"package_id":pack,"math":geom["linear"],"fingerprint":state(page)["fp"]})


def changed_view(browser,url,rows):
    with fresh(browser,(390,844)) as page:
        page.emulate_media(color_scheme="dark")
        start_home(page,url,rows,"change")
        page.locator("[data-action=language]").click()
        expect(page.locator("html")).to_have_attribute("lang","en")
        question(rows,page,"english-focus",0)
        page.set_viewport_size({"width":844,"height":390})
        question(rows,page,"portrait-to-landscape",0)
        page.set_viewport_size({"width":390,"height":370})
        question(rows,page,"reduced-height-input",0)
        symbols=page.locator(".kp-symbols")
        symbols.locator("summary").tap()
        symbols.locator("[data-symbol]").first.tap()
        page.keyboard.type("1")
        symbols.get_by_role("button",name="Fraction slash").tap()
        page.keyboard.type("2")
        expect(page.locator(FIELD)).to_have_value("-1/2")
        # Deliberate manual scroll while the learner owns the answer field.
        page.evaluate("window.scrollTo(0,document.documentElement.scrollHeight)")
        command(page,"enter")
        expect(page.locator(FEEDBACK)).to_be_focused()
        expect(page.locator(FEEDBACK)).to_have_attribute("data-state","incorrect")
        summary=page.locator(".verdict-steps summary")
        summary.focus()
        command(page,"enter")
        expect(page.locator(".verdict-steps")).to_have_attribute("open","")
        # Measure the displayed solution itself. A programmatic jump to the
        # document footer would test the browser's native handling of offscreen
        # summary focus, instead of the learner's place in the explanation.
        step=".verdict-steps .step-list li:last-child"
        page.evaluate(MEASURE,{"step":step})
        initial=page.locator(step).evaluate("""el=>{
            el.scrollIntoView({block:'center',behavior:'instant'});
            return el.getBoundingClientRect().top;
        }""")
        sample=page.evaluate(MEASURE,{"step":step})["rects"]["step"]
        record(rows,"keep-reading",sample["visible"] and sample["hit"] and abs(initial-sample["top"])<=1
               and summary.evaluate("s=>s===document.activeElement"),
               "The displayed solution step retains its reading position and the summary retains focus",
               {"beforeStepTop":initial,"afterStep":sample})
        page.locator(NEXT).tap()
        question(rows,page,"english-dark-next",1)
        current=state(page)
        record(rows,"english-dark-symbol-ledger",current["grades"]==1 and current["index"]==1
               and page.locator("html").get_attribute("data-theme")=="dark",
               "English dark view and tap-accessible fraction/minus keys produce one submission",
               {"grade_events":current["grades"],"index":current["index"],"entered":"-1/2"})


def late_layout(browser,dist,rows):
    # Gate the real asset responses at the local origin. The browser still uses
    # its normal font loader, module loader and unchanged renderer.
    origin=TestOrigin(dist)
    regular_handler=origin.RequestHandlerClass
    assets={"font":Event(),"typesetter":Event()}
    received={kind:Event() for kind in assets}
    timed_out=Event()

    class DelayedAssets(regular_handler.func):
        def do_GET(self):
            path=self.path.split("?",1)[0]
            kind="font" if path.endswith(".woff") else "typesetter" if path.endswith("/typeset.mjs") else None
            if kind:
                received[kind].set()
                if not assets[kind].wait(15):
                    timed_out.set()
            super().do_GET()

    origin.RequestHandlerClass=partial(DelayedAssets,**regular_handler.keywords)
    ctx=browser.new_context(viewport={"width":320,"height":568},service_workers="block",reduced_motion="reduce")
    try:
        page=ctx.new_page()
        page.goto(origin.url,wait_until="domcontentloaded")
        page.locator(HOME).click()
        expect(page.locator("#kp-expression")).to_have_attribute("data-math","pending")
        pending=page.locator("#kp-expression").get_attribute("data-linear")
        for kind,request in received.items():
            if not request.wait(4):
                raise AssertionError(f"Origin did not receive the expected {kind} request")
        assets["typesetter"].set()
        expect(page.locator(FIELD)).to_be_focused()
        answer(page,state(page),"incorrect")
        command(page,"enter")
        expect(page.locator(FIELD)).to_be_focused()
        assets["font"].set()
        question(rows,page,"late-typeset-font-next",1)
        record(rows,"late-assets-observed",not timed_out.is_set() and bool(pending)
               and state(page)["grades"]==1,"Render the next question after controlled typesetter and font release",
               {"assetsObserved":sorted(received),"pendingLinear":pending,"timeout":timed_out.is_set()})
    finally:
        for gate in assets.values():
            gate.set()
        ctx.close()
        origin.close()


def native_zoom(pw,url,rows):
    with TemporaryDirectory() as profile:
        opts=dict(viewport={"width":1280,"height":900},reduced_motion="reduce")
        base=pw.firefox.launch_persistent_context(profile,**opts)
        try:
            base.pages[0].goto(url);base.pages[0].locator(HOME).wait_for()
        finally:
            base.close()
        set_site_zoom(profile,2)
        ctx=pw.firefox.launch_persistent_context(profile,**opts)
        try:
            page=ctx.pages[0]
            start_home(page,url,rows,"native-zoom-200")
            geom=page.evaluate(MEASURE,TARGETS)
            record(rows,"native-zoom-scale",geom["layout"]==[640,450],
                   "Firefox full-page 200% zoom halves the CSS width and height of the same window",geom["layout"])
            transition(page,rows,"native-zoom-200-wrong","incorrect","enter")
        finally:
            ctx.close()


def run(args):
    release=json.loads((args.dist/"offline-assets.json").read_bytes())["release"]
    checks=[]
    result={"schema":"kalibataku-qa-receipt/1","suite":"next-viewport-"+args.engine,"started":now(),
            "build":{"offline_release":release},"runtime":{"engine":args.engine,"os":platform.platform(),"python":platform.python_version()},
            "scope":"Actual desktop engine. Browser touch input and CSS viewport do not certify physical keyboards or devices.",
            "checks":checks}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    origin=TestOrigin(args.dist)
    try:
        with sync_playwright() as pw:
            exe=os.environ.get("CHROMIUM_PATH") if args.engine=="chromium" else None
            browser=getattr(pw,args.engine).launch(executable_path=exe)
            result["runtime"]["version"]=browser.version
            try:
                matrix(browser,origin.url,checks,args.out.parent,args.engine)
                for fn in [shortcuts,continuity,long_expression,changed_view,late_layout]:
                    try:
                        fn(browser,args.dist if fn is late_layout else origin.url,checks)
                    except Exception as ex:
                        record(checks,fn.__name__+"-execution",False,"Complete the requested browser scenario",str(ex)[:1700])
            finally:
                browser.close()
            if args.engine=="firefox":
                try:
                    native_zoom(pw,origin.url,checks)
                except Exception as ex:
                    record(checks,"native-zoom-execution",False,"Complete true desktop Firefox 200% zoom",str(ex)[:1700])
    finally:
        origin.close()
    result["assertions"]=len(checks)
    failed=[r["id"] for r in checks if r["status"]!="PASS"]
    result.update(finished=now(),status="FAIL" if failed else "PASS")
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8",newline="\n")
    print(f"{args.engine} {result['runtime'].get('version')}: {len(checks)-len(failed)}/{len(checks)}; failed {failed}",flush=True)
    return int(bool(failed))


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("engine",choices=["chromium","firefox","webkit"])
    parser.add_argument("--dist",type=Path,default=ROOT/"dist")
    parser.add_argument("--out",type=Path,required=True)
    raise SystemExit(run(parser.parse_args()))
