"""Execute local synthetic role tasks and inspect the actual Chromium accessibility tree."""
import argparse
import json
import os
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests/journey"))
from offline_capability import cache_inventory, fresh_map, map_install, offline_mode, verify_origin_down
from offline_origin import TestOrigin

FIELD = "#kp-answer"
FEEDBACK = "[data-answer-feedback]"
HOME = "[data-cta=adventure]"
NEXT = "[data-part=next]"
SYNTHETIC_NAME = "QA Sintetis Melati"


def stamp():
    return datetime.now(timezone.utc).isoformat()


def check(rows, label, expectation, passed, actual):
    rows.append({"id": label, "status": "PASS" if passed else "FAIL",
                 "expected": expectation, "actual": actual})


def stored(page, attempt=None):
    return page.evaluate("""async id => {
      const s=await import('./data/store.js'), scope=s.activeScope();
      const a=await s.getAttempt(id||location.hash.split('/').at(-1), scope);
      const events=await s.listEvents(a.attempt_id, scope);
      return {attempt:a.attempt_id, profile:scope.profileId, index:a.index, status:a.status,
        items:a.items.map(i=>({id:i.question_instance_id, key:i.question.answer,
          draft:i.draft, hist:i.history.map(h=>[h.is_correct,!!h.key_seen_before]),
          hint:!!i.hint_used})),
        submissions:events.filter(e=>e.event_type==='answer.submitted').map(e=>e.event_id),
        completions:events.filter(e=>e.event_type==='attempt.completed').map(e=>e.event_id)};
    }""", attempt)


def exact(state):
    key = state["items"][state["index"]]["key"]
    return str(key["numerator"]) if str(key["denominator"]) == "1" else f"{key['numerator']}/{key['denominator']}"


def submit(page, value):
    field = page.locator(FIELD)
    field.fill(value)
    page.keyboard.press("Enter")
    expect(page.locator(FEEDBACK)).to_be_focused()


def synthetic(browser, origin, rows):
    # Each participant/device is an empty synthetic browser store. All learner and
    # operator actions use public controls; store reads observe the result only.
    context = browser.new_context(viewport={"width": 390, "height": 844})
    recovery = browser.new_context(viewport={"width": 1000, "height": 760})
    try:
        page = context.new_page()
        page.goto(origin.url + "#/profiles")
        page.get_by_text("Tambah profil pada perangkat ini", exact=True).click()
        page.get_by_label("Nama panggilan").fill(SYNTHETIC_NAME)
        page.get_by_role("button", name="Buat dan gunakan profil").click()
        expect(page.get_by_role("heading", name=SYNTHETIC_NAME)).to_be_visible()
        profile = page.get_by_label("Pilih profil latihan").input_value()
        check(rows,"named-local-profile","New isolated named practice profile",bool(profile and profile!="local-default"),{"profile": profile})
        page.goto(origin.url)
        page.locator(HOME).wait_for()
        routes = []
        page.on("framenavigated", lambda frame: routes.append(frame.url.split("#")[-1].split("?")[0])
                if frame == page.main_frame else None)
        page.locator(HOME).click()
        expect(page.locator(FIELD)).to_be_focused()
        first = stored(page)
        aid = first["attempt"]
        catalog_routes = [r for r in routes if r.startswith(("/packs","/curriculum","/start-point"))]
        check(rows,"one-action-start","One home CTA opens initial question on named profile, without filters",
              first["index"]==0 and first["profile"]==profile and not catalog_routes,
              {"activations":1,"routes":list(routes),"question_count":len(first["items"])})
        page.locator("[data-part=hint]").click()
        expect(page.locator("[data-hint]")).to_be_focused()
        submit(page,"-999")
        expect(page.locator(FEEDBACK)).to_have_attribute("data-state","incorrect")
        wrong = stored(page)
        check(rows,"assisted-first-error","Hint and first incorrect response recorded on item 1 with no advance",
              wrong["index"]==0 and wrong["items"][0]["hint"] and wrong["items"][0]["hist"]==[[False,False]],
              {"index":wrong["index"],"item":wrong["items"][0]})
        page.locator(".verdict-steps summary").click()
        expect(page.locator(".verdict-steps")).to_have_attribute("open","")
        tiles = [page.locator(f"{FEEDBACK} .verdict-tile.{k}").inner_text() for k in ("mine","key")]
        check(rows,"disclosure-and-both-answers","Student's error, answer key, and worked steps are available",
              "999" in tiles[0] and exact(first) in tiles[1] and bool(page.locator(".verdict-steps").inner_text().strip()),tiles)
        page.locator("[data-part=revise]").click()
        submit(page,exact(first))
        revised = stored(page)
        check(rows,"assisted-revision","First incorrect response survives correct revision after reveal",
              revised["items"][0]["hist"]==[[False,False],[True,True]] and len(revised["submissions"])==2,
              revised["items"][0])
        page.reload()
        expect(page.locator(FEEDBACK)).to_be_focused()
        resumed = stored(page)
        check(rows,"resume-feedback","Reload restores the same attempt, occurrence order and revisions",
              resumed==revised,{"attempt":aid,"history":resumed["items"][0]["hist"]})
        page.keyboard.press("Enter")
        expect(page.locator(FIELD)).to_be_focused()
        transitions = []
        for index in range(1,len(first["items"])):
            before = stored(page)
            value = exact(before) if index % 2 == 0 else "-997"
            submit(page,value)
            after = stored(page)
            page.keyboard.press("Enter")
            if index < len(first["items"])-1:
                expect(page.locator(FIELD)).to_be_focused()
            else:
                expect(page.locator(".mission-result")).to_be_visible()
            transitions.append({"item":index,"check_index":after["index"],"response_delta":len(after["submissions"])-len(before["submissions"])})
        finished = stored(page,aid)
        check(rows,"error-heavy-completion","Each response holds its index; one new Enter advances; completion exactly once",
              all(row["item"]==row["check_index"] and row["response_delta"]==1 for row in transitions)
              and len(finished["completions"])==1 and len(finished["submissions"])==len(first["items"])+1,
              {"transitions":transitions,"completions":finished["completions"],"responses":len(finished["submissions"])})
        page.locator("[data-part=next-mission]").click()
        expect(page.locator(FIELD)).to_be_focused()
        second=stored(page)
        check(rows,"one-action-follow-on","One action opens next distinct mission with no grade or inherited draft",
              second["attempt"]!=aid and second["index"]==0 and not second["submissions"] and second["items"][0]["draft"]=="",
              {"activations":1,"attempt":second["attempt"],"routes":list(routes)})
        page.locator(FIELD).fill("37/9")
        expect(page.locator(".kp-row small").filter(has_text="Tersimpan di perangkat")).to_be_visible()
        active=stored(page)
        assert active["items"][0]["draft"]=="37/9", "Draft was not committed after the saved indicator"
        page.goto(origin.url+"#/reports")
        page.get_by_role("link",name="Latihan profil aktif pada perangkat ini").click()
        paper=page.locator(".tw-paper")
        expect(paper).to_contain_text("Sesi selesai dalam periode ini: 1")
        paper_text=paper.inner_text()
        check(rows,"teacher-local-source","Report for active practice profile distinguishes 1 completed and 1 ongoing mission",
              "Berjalan: 1" in paper_text and "belum diverifikasi institusi" in paper_text and SYNTHETIC_NAME in paper_text,
              {"source":"local_practice","name":SYNTHETIC_NAME,"report_excerpt":paper_text[:360]})
        page.get_by_label("Bahasa laporan").select_option("bilingual")
        expect(paper).to_contain_text("Parent meeting report")
        check(rows,"teacher-bilingual","The same teacher preview contains both languages after one report option change",
              "Laporan pertemuan orang tua" in paper.inner_text() and "Parent meeting report" in paper.inner_text(),
              {"languages":["id","en"],"locale":page.get_by_label("Bahasa laporan").input_value()})
        page.goto(origin.url+"#/profiles")
        with TemporaryDirectory() as tmp:
            with page.expect_download() as pending:
                page.get_by_role("button",name="Unduh cadangan profil",exact=True).click()
            backup = Path(tmp)/"qa-profile.zip"
            pending.value.save_as(str(backup))
            other = recovery.new_page()
            other.goto(origin.url+"#/profiles")
            other.locator('input[type=file]').set_input_files(str(backup))
            confirmation = other.get_by_role("button",name="Pulihkan ke profil "+SYNTHETIC_NAME)
            expect(confirmation).to_be_visible()
            installed_before = other.get_by_label("Pilih profil latihan").locator("option").all_text_contents()
            check(rows,"backup-preview","New browser previews real backup with matching named profile before import",
                  backup.stat().st_size>0 and SYNTHETIC_NAME not in installed_before,
                  {"bytes":backup.stat().st_size,"prior_profiles":installed_before,"target":SYNTHETIC_NAME})
            confirmation.click()
            other.get_by_role("button",name="Buka profil hasil pemulihan").click()
            expect(other.get_by_role("heading",name=SYNTHETIC_NAME)).to_be_visible()
            restored_old=stored(other,aid)
            restored_active=stored(other,second["attempt"])
            check(rows,"restore-ledgers","Both attempts, order, keys, draft, first answers, assistance and event IDs match",
                  restored_old==finished and restored_active==active,
                  {"restored_attempts":[restored_old["attempt"],restored_active["attempt"]],
                   "differences":[{k:[a.get(k),b.get(k)] for k in set(a)|set(b) if a.get(k)!=b.get(k)} for a,b in [(finished,restored_old),(active,restored_active)]],"response_events":len(restored_old["submissions"]),"draft":restored_active["items"][0]["draft"]})
        fresh_map(other,origin.url)
        map_install(other)
        installed=cache_inventory(other)
        other.reload()
        other.locator(".offline-mission [data-offline-state=ready]").wait_for()
        offline_mode(recovery,other,origin,"chromium")
        other.goto(origin.url)
        other.reload()
        other.locator(HOME).click()
        expect(other.locator(FIELD)).to_be_focused()
        verify_origin_down(other)
        check(rows,"offline-resume-after-restore","One home action offline resumes restored draft with its frozen order",
              stored(other)==active and other.locator(FIELD).input_value()=="37/9",
              {"installations":installed,"uncached_request_rejected":True,"server_refuses_connections":origin.disconnected,"activations":1,"draft":other.locator(FIELD).input_value()})
    finally:
        origin.disconnected=False
        context.close()
        recovery.close()


def ax(cdp, selector):
    obj = cdp.send("Runtime.evaluate", {"expression":"document.querySelector("+json.dumps(selector)+")"})["result"]["objectId"]
    try:
        nodes = cdp.send("Accessibility.getPartialAXTree", {"objectId":obj,"fetchRelatives":False})["nodes"]
        node = next(n for n in nodes if not n.get("ignored"))
        return {k:node.get(k,{}).get("value","") for k in ("role","name","description","value")}
    finally:
        cdp.send("Runtime.releaseObject", {"objectId":obj})


def keyboard_target(page, selector):
    visited=[]
    for index in range(55):
        if page.locator(selector).evaluate("e=>e===document.activeElement"):
            return visited
        page.keyboard.press("Tab")
        visited.append(page.evaluate("document.activeElement.tagName+':'+(document.activeElement.innerText||'').slice(0,50)"))
    raise AssertionError(f"Tab did not reach {selector}. Visited {visited}")


def error_relation(page):
    return page.locator(FIELD).evaluate(r"""e=>{const ids=e.getAttribute('aria-describedby').split(/\s+/),
     alert=document.getElementById('kp-input-error');return !!(alert?.isConnected && alert.getAttribute('role')==='alert'
     && alert.innerText.trim() && ids.includes(alert.id) && e.getAttribute('aria-invalid')==='true');}""")


def semantic(browser,origin,rows):
    for locale in ("id","en"):
        theme="light" if locale=="id" else "dark"
        context=browser.new_context(viewport={"width":320,"height":568}, reduced_motion="reduce",color_scheme=theme)
        try:
            page=context.new_page()
            page.goto(origin.url)
            page.locator(HOME).wait_for()
            if locale=="en":
                keyboard_target(page,"[data-action=language]")
                page.keyboard.press("Enter")
                expect(page.locator("html")).to_have_attribute("lang","en")
            cdp=context.new_cdp_session(page)
            cdp.send("Accessibility.enable")
            def test(label,expectation,passed,value):
                check(rows,locale+"-"+label,expectation,passed,value)
            visited=keyboard_target(page,HOME)
            home=ax(cdp,HOME)
            ring=page.locator(HOME).evaluate("""el=>({visible:el.matches(':focus-visible'),width:parseFloat(getComputedStyle(el).outlineWidth),style:getComputedStyle(el).outlineStyle})""")
            test("keyboard-entry","Public primary action has a link name, can receive keyboard focus, and displays an outline",
                 home["role"]=="link" and bool(home["name"]) and ring["visible"] and ring["width"]>=1 and ring["style"]!="none",{"ax":home,"ring":ring,"tab_path":visited})
            test("landmarks","Main landmark and one visible level-one heading in requested UI language",
                 ax(cdp,"main")["role"]=="main" and page.locator("main h1:visible").count()==1 and page.locator("html").get_attribute("lang")==locale,
                 {"main":ax(cdp,"main"),"h1":ax(cdp,"main h1"),"lang":locale})
            page.keyboard.press("Enter")
            expect(page.locator(FIELD)).to_be_focused()
            field=ax(cdp,FIELD)
            ids=page.locator(FIELD).get_attribute("aria-describedby").split()
            lengths={i:page.locator("#"+i).count() for i in ids}
            test("input-context","Keyboard entry lands on a named textbox with descriptions for position, expression and format",
                 field["role"]=="textbox" and field["name"]==("Jawabanmu" if locale=="id" else "Your answer")
                 and set(lengths)=={"kp-question-position","kp-expression","kp-input-help"} and set(lengths.values())=={1} and bool(field["description"]),
                 {"ax":field,"references":lengths})
            maths=page.locator("#kp-expression")
            role=ax(cdp,"#kp-expression")
            linear=maths.get_attribute("data-linear")
            surface=maths.locator(".math-surface").get_attribute("aria-hidden")
            test("math-text","Typeset formula exposes one localized named math node and a grouped linear expression",
                 role["role"].lower()=="math" and (" tambah " if locale=="id" else " plus ") in " "+role["name"]+" " and "+" in linear and surface=="true",
                 {"ax":role,"linear":linear,"visual_surface_hidden_from_ax":surface})
            maths.evaluate("el=>el.removeAttribute('aria-label')")
            unnamed=ax(cdp,"#kp-expression")
            maths.evaluate("(el,name)=>el.setAttribute('aria-label',name)",role["name"])
            test("missing-math-label-control","Removing the accessible math label is detected by the actual tree",
                 unnamed["name"]=="" and ax(cdp,"#kp-expression")["name"]==role["name"],{"mutated":unnamed,"restored":role})
            progress=ax(cdp,"progress")
            live=ax(cdp,"[data-time-announcer]")
            live_attr=page.locator("[data-time-announcer]").get_attribute("aria-live")
            test("progress-and-live","Progress has accessible position and timer updates have a polite live region",
                 progress["role"]=="progressbar" and bool(progress["name"]) and page.locator("progress").evaluate("e=>e.value===1&&e.max>1")
                 and live["role"]=="status" and live_attr=="polite",{"progress":progress,"live":live,"aria_live":live_attr})
            geom=page.evaluate("""()=>{const expr=document.querySelector('#kp-expression').getBoundingClientRect(),input=document.querySelector('#kp-answer').getBoundingClientRect();
              const s=getComputedStyle(document.querySelector('#kp-answer'));return {viewport:innerWidth,doc:document.documentElement.scrollWidth,expr_top:expr.top,input_bottom:input.bottom,
                height:innerHeight,reduce:matchMedia('(prefers-reduced-motion: reduce)').matches,animation:s.animationName,transition:s.transitionDuration,scroll:s.scrollBehavior}}""")
            test("reflow-motion","At 320 CSS pixels, input and formula fit viewport; reduced-motion styles disable animation and transitions",
                 geom["doc"]<=geom["viewport"] and 0<=geom["expr_top"]<=geom["input_bottom"]<=geom["height"]+1
                 and geom["reduce"] and geom["animation"]=="none" and all(float(n.strip().removesuffix("s"))==0 for n in geom["transition"].split(","))
                 and geom["scroll"]=="auto",geom)
            page.keyboard.press("Enter")
            expect(page.locator("[role=alert]")).to_be_visible()
            alert=ax(cdp,"#kp-input-error")
            test("empty-error","Empty Enter exposes a described alert and retains focus on the invalid field",
                 error_relation(page) and alert["role"]=="alert" and page.locator(FIELD).evaluate("e=>e===document.activeElement"),
                 {"ax":alert,"description":ax(cdp,FIELD)["description"],"message":page.locator("#kp-input-error").inner_text()})
            described=page.locator(FIELD).get_attribute("aria-describedby")
            page.locator(FIELD).evaluate("e=>e.setAttribute('aria-describedby','missing-fixture-reference')")
            rejected=not error_relation(page)
            page.locator(FIELD).evaluate("(e,value)=>e.setAttribute('aria-describedby',value)",described)
            test("broken-error-control","Missing description reference is rejected and restored reference is accepted",
                 rejected and error_relation(page),{"mutant_rejected":rejected,"restored":error_relation(page)})
            page.keyboard.type("-997")
            page.keyboard.press("Enter")
            expect(page.locator(FEEDBACK)).to_be_focused()
            result=ax(cdp,FEEDBACK)
            next_action=ax(cdp,NEXT)
            snapshot=page.locator(FEEDBACK).aria_snapshot()
            test("feedback-focus","Named result region receives focus, holds two labeled values and an accessible next action",
                 result["role"]=="region" and bool(result["name"]) and snapshot.count("term:")>=2
                 and snapshot.count("math ")>=2 and next_action["role"]=="button" and "Enter" in next_action["name"],
                 {"ax":result,"next":next_action,"tree_excerpt":snapshot[:800]})
            colors=page.evaluate(r"""()=>{const channels=v=>v.match(/[\d.]+/g).map(Number);
              const lum=cs=>cs.slice(0,3).map(c=>c/255).map(c=>c<=0.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
              function sample(sel){const e=document.querySelector(sel),fg=channels(getComputedStyle(e).color);
                let p=e,bg;while(p){const c=channels(getComputedStyle(p).backgroundColor); if(c.length===3||c[3]===1){bg=c;break;} if(c[3]!==0)throw Error("Partially transparent color");p=p.parentElement;}
                if(!bg)throw Error("No opaque background");const l=lum(fg),b=lum(bg);return {selector:sel,fg,bg,ratio:(Math.max(l,b)+.05)/(Math.min(l,b)+.05)};}
              return {theme:document.documentElement.dataset.theme,samples:['[data-answer-feedback] h2','.verdict-tile.mine dt','.verdict-tile.key dt','[data-part=next]','[data-part=revise]'].map(sample)};}""")
            test("rendered-contrast","Result title, value labels and both action buttons have at least 4.5:1 text contrast",
                 colors["theme"]==theme and all(s["ratio"]>=4.5 for s in colors["samples"]),colors)
            capture=os.environ.get("KALIBATAKU_REVIEW_CAPTURE")
            if capture:
                path=Path(capture); path.mkdir(parents=True,exist_ok=True)
                page.screenshot(path=path/("feedback-"+locale+".png"))
            page.keyboard.press("Enter")
            expect(page.locator(FIELD)).to_be_focused()
            after=stored(page)
            test("keyboard-next","Fresh Enter advances once, the empty second item is focused and progress updates",
                 after["index"]==1 and page.locator(FIELD).input_value()=="" and len(after["submissions"])==1
                 and page.locator("progress").evaluate("e=>e.value===2"),
                 {"index":after["index"],"submissions":len(after["submissions"]),"progress":ax(cdp,"progress")})
        finally:
            context.close()


def main():
    import traceback
    sys.path.insert(0,str(ROOT/"tools"))
    import qa_core as qa
    parser=argparse.ArgumentParser()
    parser.add_argument("suite",choices=["synthetic-journeys","semantic-access"])
    parser.add_argument("--out",type=Path,required=True)
    args=parser.parse_args()
    started=stamp()
    rows=[]
    errors=[]
    runtime={"platform":platform.system(),"python":platform.python_version()}
    origin=TestOrigin(ROOT/"dist")
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"))
            runtime.update({"browser":"Chromium","browser_version":browser.version})
            try:
                (synthetic if args.suite=="synthetic-journeys" else semantic)(browser,origin,rows)
            finally:
                browser.close()
    except Exception:
        errors.append(traceback.format_exc())
        print(errors[-1],file=sys.stderr)
    finally:
        origin.close()
    passed=bool(rows) and not errors and all(row["status"]=="PASS" for row in rows)
    body={"schema":qa.SCHEMA,"suite":args.suite,"status":"PASS" if passed else "FAIL",
          "started":started,"finished":stamp(),"runtime":runtime,"build":qa.identity(ROOT),
          "scope":"Synthetic role tasks and Chromium engine observations in Linux; no physical device, human participant or speech trial.",
          "assertions":len(rows),"checks":rows,"errors":errors}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(body,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    for row in rows:
        if row["status"]!="PASS": print(row,file=sys.stderr)
    print(args.suite,body["status"],len(rows),"checks")
    return int(not passed)


if __name__=="__main__":
    sys.exit(main())
