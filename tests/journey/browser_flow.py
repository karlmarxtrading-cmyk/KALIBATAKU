"""Adventure student flow in a Playwright-managed browser engine.

home (new user) -> Mulai dari dasar -> mission arena -> answer every question
-> feedback -> Lanjut -> last question 'Lihat hasil' (single finalize, no review grid)
-> mission result with one next action -> next mission -> reload mid-mission and
resume the same frozen questions -> map list with statuses -> start point.
Also checks two wrong answers in a row show the help offer without changing the question,
double activation of 'Lihat hasil' completes once, 320 px reflow, keyboard focus and
44 px targets of core controls, dark theme and English.

  python3 tests/journey/browser_flow.py [--out DIR]
Writes a kalibataku-qa-receipt/1 receipt (journey-browser.json) and screenshots.
"""
import argparse, json, os, sys, hashlib, traceback
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests" / "qa"))
try:
    from receipt import Suite  # type: ignore
except Exception:  # pragma: no cover
    Suite = None


class Checks:
    def __init__(self):
        self.rows = []
        self.started = datetime.now(timezone.utc).isoformat()

    def check(self, cid, expected, fn):
        try:
            actual = fn()
            self.rows.append({"id": cid, "status": "PASS", "expected": expected, "actual": actual})
            return actual
        except Exception as e:  # noqa
            self.rows.append({"id": cid, "status": "FAIL", "expected": expected, "actual": repr(e)[:1500]})
            return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "evidence" / "v15" / "browser"))
    ap.add_argument("--receipts", default=os.environ.get("KALIBATAKU_RECEIPTS", str(ROOT / "evidence" / "v15" / "receipts")))
    ap.add_argument("--engine", choices=("chromium","firefox","webkit"), default="chromium")
    args = ap.parse_args()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    from offline_origin import TestOrigin
    server = TestOrigin(ROOT / "dist")
    base = server.url
    C = Checks()
    shots = []
    errors = []
    engine_version = exe = None
    try:
        with sync_playwright() as pw:
            exe = os.environ.get("CHROMIUM_PATH") if args.engine == "chromium" else None
            browser = getattr(pw, args.engine).launch(executable_path=exe)
            engine_version = browser.version
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, bypass_csp=True)  # CSP blocks Playwright wait_for_function only
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))

            def wait_view(route):
                marker = {"#/":"[data-cta=adventure]", "#/map":".map-stage"}.get(route, ".kp-answer")
                page.locator(marker).first.wait_for(state="visible")

            def shot(name):
                p = out / (name + ".png"); page.screenshot(path=str(p), full_page=False); shots.append(p.name)

            def attempt():
                return page.evaluate("""async()=>{const id=decodeURIComponent(location.hash.split('/')[2]||'');
                  const s=await import('./data/store.js');return await s.getAttempt(id,s.activeScope());}""")

            def ans(v):
                return v["numerator"] if v["denominator"] == "1" else v["numerator"] + "/" + v["denominator"]

            page.goto(base)
            page.wait_for_selector("[data-cta=adventure]")
            C.check("home-new-user-cta", "one dominant CTA 'Mulai dari dasar' and optional start point",
                    lambda: (page.locator(".btn.primary").count() == 1 and "Mulai dari dasar" in page.inner_text("[data-cta=adventure]")
                             and page.locator("a[href='#/start-point']").count() >= 1) or (_ for _ in ()).throw(AssertionError(page.inner_text("main")[:400])))
            def visible_profile():
                control = page.locator(".profile-control")
                assert control.is_visible()
                assert control.locator("strong").inner_text().strip()
                return control.inner_text()
            C.check("home-profile-visible", "active profile shown", visible_profile)
            shot("01-home-new")
            page.click("[data-cta=adventure]")
            page.wait_for_selector(".kp-answer", timeout=15000)
            a = attempt()
            C.check("mission-created-frozen", "intro mission of 6 with frozen refs and trace",
                    lambda: (len(a["items"]) == 6 and a["journey"]["mission_kind"] == "intro" and len(a["journey"]["selected_occurrence_refs"]) == 6
                             and a["journey"]["selection_trace"]["chosen"] == a["package_id"]) and {"package": a["package_id"], "node": a["journey"]["node_id"]}
                    or (_ for _ in ()).throw(AssertionError(json.dumps(a.get("journey"))[:300])))
            shot("02-arena")
            C.check("arena-one-primary", "question state has exactly one primary action (Periksa)",
                    lambda: (page.locator("main .kp-btn.main:visible, main button.main:visible").count() == 1 and "Periksa" in page.locator("main .kp-btn.main:visible").first.inner_text()) or (_ for _ in ()).throw(AssertionError(page.locator("main .main:visible").count())))
            C.check("arena-menu-no-school-spaces", "menu inside a mission has no teacher/admin entries",
                    lambda: page.locator("#app-header a[href^='#/demo/']").count() == 0 or (_ for _ in ()).throw(AssertionError(page.locator("#app-header a[href^='#/demo/']").count())))
            first_ids = [i["question"]["question_id"] for i in a["items"]]
            # answer: q1 wrong, q2 wrong (streak), rest correct
            for k in range(6):
                page.wait_for_selector(".kp-answer:not([readonly])")
                q = a["items"][k]["question"]["answer"]
                text = ans(q)
                if k in (0, 1):
                    text = str(int(q["numerator"]) + 1) if q["denominator"] == "1" else q["numerator"] + "/" + str(int(q["denominator"]) + 1)
                page.fill(".kp-answer", text)
                page.keyboard.press("Enter")
                page.wait_for_selector("[data-answer-feedback]")
                if k == 0:
                    C.check("feedback-shows-answer-and-key", "student answer + key + one idea + steps collapsed",
                            lambda: (page.locator(".verdict-tile.mine").count() == 1 and page.locator(".verdict-tile.key").count() == 1
                                     and page.locator(".verdict-idea").count() == 1 and page.locator("details.verdict-steps:not([open])").count() == 1) or (_ for _ in ()).throw(AssertionError()))
                    # no auto-next: wait and verify still on q1 feedback
                    page.wait_for_timeout(1500)
                    C.check("no-auto-next", "feedback stays until Lanjut", lambda: attempt()["index"] == 0 or (_ for _ in ()).throw(AssertionError()))
                if k == 1:
                    C.check("wrong-streak-help", "help offer shown, question unchanged",
                            lambda: (page.locator("[data-wrong-streak]").count() == 1 and attempt()["items"][1]["question"]["question_id"] == first_ids[1]) or (_ for _ in ()).throw(AssertionError()))
                    shot("03-wrong-streak")
                if k < 5:
                    btn = page.locator("[data-part=next]")
                    C.check(f"next-button-{k}", "core button >= 44x44 css px", lambda: (lambda b: (b["height"] >= 44 and b["width"] >= 44) and b or (_ for _ in ()).throw(AssertionError(b)))(btn.bounding_box()))
                    btn.click()
            # last question: 'Lihat hasil', double activation completes once
            last = page.locator("[data-part=next]")
            def last_action_label():
                label = last.inner_text().strip()
                assert label == "Lihat hasil · Enter", label
                return label
            C.check("last-label-lihat-hasil", "last feedback offers 'Lihat hasil'", last_action_label)
            last.dblclick()
            page.wait_for_selector(".mission-result", timeout=15000)
            shot("04-result")
            res = page.evaluate("""async()=>{const id=decodeURIComponent(location.hash.split('/')[2]);const s=await import('./data/store.js');
              const ev=await s.listEvents(id,s.activeScope());return {status:(await s.getAttempt(id,s.activeScope())).status,completed:ev.filter(e=>e.event_type==='attempt.completed').length};}""")
            C.check("single-finalize", "exactly one attempt.completed event, no review grid", lambda: (res["completed"] == 1 and res["status"] == "completed" and page.locator(".kp-map").count() == 0) and res or (_ for _ in ()).throw(AssertionError(res)))
            C.check("result-one-next-action", "one primary next action with reason", lambda: (page.locator(".mission-result .kp-btn.main, .mission-result button.main").count() == 1 and page.locator(".mission-next").inner_text()) or (_ for _ in ()).throw(AssertionError(page.inner_text("main")[:500])))
            C.check("result-independent-counts", "first-response independent count excludes the 2 wrong", lambda: (("4 dari 6" in page.inner_text(".mission-result .kp-lead")) and page.inner_text(".mission-result .kp-lead")) or (_ for _ in ()).throw(AssertionError(page.inner_text(".mission-result .kp-lead"))))
            page.click("[data-part=next-mission]")
            page.wait_for_selector(".kp-answer", timeout=15000)
            b = attempt()
            def second():
                tr = b["journey"]["selection_trace"]
                overlap = len(set(first_ids) & {i["question"]["question_id"] for i in b["items"]})
                flagged = sum(1 for i in b["items"] if i.get("journey_review"))
                # G1 L1 addition has 12 unique teaching items: after an intro of 6 the
                # selector must take every unseen item it can and label the rest as review.
                assert overlap == tr["review"] == flagged, (overlap, tr)
                assert tr["unique_new"] == max(c["unseen"] for c in tr["candidates"]), tr
                assert overlap == 0 or tr["reasons"], tr
                return {"kind": b["journey"]["mission_kind"], "n": len(b["items"]), "new": tr["unique_new"], "review": tr["review"], "reasons": tr["reasons"]}
            C.check("second-mission-new-questions", "next mission takes all unseen material first; repeats are labelled review with a reason", second)
            # answer two then reload: same frozen questions, same position
            for k in range(2):
                q = b["items"][k]["question"]["answer"]
                page.fill(".kp-answer", ans(q)); page.keyboard.press("Enter"); page.wait_for_selector("[data-answer-feedback]")
                page.click("[data-part=next]"); page.wait_for_selector(".kp-answer:not([readonly])")
            page.goto(base + "#/")
            page.wait_for_selector("[data-cta=adventure]")
            C.check("home-resume-cta", "returning user: one CTA 'Lanjutkan petualangan' to the ongoing mission",
                    lambda: ("Lanjutkan petualangan" in page.inner_text("[data-cta=adventure]") and b["attempt_id"] in page.get_attribute("[data-cta=adventure]", "href")) or (_ for _ in ()).throw(AssertionError(page.inner_text("main")[:300])))
            page.reload(); page.wait_for_selector("[data-cta=adventure]")
            page.click("[data-cta=adventure]"); page.wait_for_selector(".kp-answer")
            c = attempt()
            C.check("resume-same-snapshot", "resume keeps question ids, order and index",
                    lambda: ([i["question"]["question_id"] for i in c["items"]] == [i["question"]["question_id"] for i in b["items"]] and c["index"] == 2) or (_ for _ in ()).throw(AssertionError(c["index"])))
            # language switch must not reshuffle
            page.click("[data-action=language]"); page.wait_for_timeout(500)
            d = attempt()
            C.check("language-no-reshuffle", "EN switch keeps the frozen questions", lambda: [i["question"]["question_id"] for i in d["items"]] == [i["question"]["question_id"] for i in b["items"]] or (_ for _ in ()).throw(AssertionError()))
            page.click("[data-action=language]"); page.wait_for_timeout(300)
            # map
            page.goto(base + "#/map"); page.wait_for_selector(".map-stage")
            C.check("map-list-statuses", "ordered list with text statuses; playing node present",
                    lambda: (page.locator("ol.map-path > li").count() >= 2 and page.locator(".map-node.is-inactive").count() == 0 and page.locator(".map-node.is-playing").count() == 1 and page.locator(".node-status.is-locked").count() >= 1) and page.locator("ol.map-path > li").count() or (_ for _ in ()).throw(AssertionError(page.inner_text("main")[:400])))
            def stage_heading():
                text = page.locator(".map-stage h2").first.inner_text()
                assert "Tahap 1" in text and "Kelas 1 · Level 1 · " in text and text.split(" · ")[-1].strip(), text
                return text
            C.check("map-region-has-skill-names", "stage headings carry grade/level/skill focus", stage_heading)
            shot("05-map")
            # keyboard: tab reaches the map action with a visible focus outline
            page.keyboard.press("Tab")
            for _ in range(40):
                if page.evaluate("document.activeElement?.closest('.map-node')!=null"):
                    break
                page.keyboard.press("Tab")
            C.check("keyboard-reaches-map", "Tab reaches a map node action with visible focus",
                    lambda: page.evaluate("(()=>{const e=document.activeElement;const s=getComputedStyle(e);return e.closest('.map-node')&&(s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0)?e.textContent.trim():null})()") or (_ for _ in ()).throw(AssertionError(page.evaluate("document.activeElement.outerHTML.slice(0,200)"))))
            # 320 px reflow on home, map, arena
            for route in ("#/", "#/map", "#/session/" + b["attempt_id"]):
                page.set_viewport_size({"width": 320, "height": 700})
                page.goto(base + route); wait_view(route)
                C.check("reflow-320-" + (route.strip("#/").split("/")[0] or "home"), "no horizontal scroll at 320 px",
                        lambda: page.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth+1") or (_ for _ in ()).throw(AssertionError(page.evaluate("document.documentElement.scrollWidth"))))
            shot("06-arena-320")
            page.evaluate("localStorage.setItem('kalibataku.preferences.v1',JSON.stringify({...JSON.parse(localStorage.getItem('kalibataku.preferences.v1')||'{}'),textSize:'xlarge'}))")
            for route in ("#/", "#/map", "#/session/" + b["attempt_id"]):
                page.goto(base + route); page.reload(); wait_view(route)
                C.check("reflow-320-large-text-" + (route.strip("#/").split("/")[0] or "home"), "no horizontal scroll at 320 px with the largest text size",
                        lambda: page.evaluate("document.documentElement.dataset.text==='xlarge'&&document.documentElement.scrollWidth<=document.documentElement.clientWidth+1") or (_ for _ in ()).throw(AssertionError(page.evaluate("[document.documentElement.dataset.text,document.documentElement.scrollWidth]"))))
            def home_cta():
                page.goto(base + "#/"); page.wait_for_selector("[data-cta=adventure]")
                b = page.locator("[data-cta=adventure]").bounding_box()
                assert b["height"] >= 44 and b["width"] >= 44, b
                return b
            C.check("home-cta-44", "home CTA at least 44x44 at 320 px with large text", home_cta)
            page.evaluate("localStorage.setItem('kalibataku.preferences.v1',JSON.stringify({...JSON.parse(localStorage.getItem('kalibataku.preferences.v1')||'{}'),textSize:'normal'}))")
            # dark + English home
            page.set_viewport_size({"width": 1024, "height": 768})
            page.evaluate("localStorage.setItem('kalibataku.preferences.v1',JSON.stringify({...JSON.parse(localStorage.getItem('kalibataku.preferences.v1')||'{}'),theme:'dark',lang:'en'}))")
            page.goto(base + "#/"); page.reload(); page.wait_for_selector("[data-cta=adventure]")
            C.check("english-dark-home", "English copy and dark theme", lambda: (page.evaluate("document.documentElement.dataset.theme") == "dark" and "Continue the adventure" in page.inner_text("[data-cta=adventure]")) or (_ for _ in ()).throw(AssertionError()))
            shot("07-home-en-dark-1024")
            # start point
            page.goto(base + "#/start-point"); page.wait_for_selector(".start-stage")
            C.check("start-targets-44", "start-stage buttons are at least 44 px tall",
                    lambda: (lambda h: h >= 44 and h or (_ for _ in ()).throw(AssertionError(h)))(page.locator(".start-stage").first.bounding_box()["height"]))
            C.check("start-point-not-a-test", "start page says it is not a test", lambda: "not a test" in page.inner_text("main") or (_ for _ in ()).throw(AssertionError()))
            # offline: save the active mission, go offline, resume, finish, start the next one
            page.evaluate("localStorage.setItem('kalibataku.preferences.v1',JSON.stringify({...JSON.parse(localStorage.getItem('kalibataku.preferences.v1')||'{}'),theme:'light',lang:'id'}))")
            page.goto(base + "#/map"); page.reload(); page.wait_for_selector(".offline-mission")
            page.evaluate("async()=>{if(!navigator.serviceWorker)throw Error('Service Worker unavailable');await navigator.serviceWorker.ready;}")
            save = page.locator(".offline-mission button")
            if save.count():
                save.click()
                page.locator(".offline-mission [role=status]").filter(has_text="Tersimpan:").wait_for(timeout=60000)
            C.check("offline-saved-two-packs", "the active mission pack and one spare are installed (not the whole bank)",
                    lambda: (lambda r: (len(r) == 2 and all(x.startswith("MM-G01-L01-ADD-") for x in r)) and r or (_ for _ in ()).throw(AssertionError(r)))(
                        page.evaluate("async()=>{const m=await import('./data/offline.js');return (await m.listInstalled()).map(r=>r.id)}")))
            server.network(False,ctx,args.engine)
            assert page.evaluate("""async()=>{try{await fetch('/probe?outage=1',{cache:'no-store'});return false}catch{return true}}"""), "Origin still reachable"
            page.goto(base + "#/"); page.reload(); page.wait_for_selector("[data-cta=adventure]", timeout=15000)
            page.click("[data-cta=adventure]"); page.wait_for_selector(".kp-answer")
            e = attempt()
            for k in range(e["index"], len(e["items"])):
                page.wait_for_selector(".kp-answer:not([readonly])")
                page.fill(".kp-answer", ans(e["items"][k]["question"]["answer"])); page.keyboard.press("Enter")
                page.wait_for_selector("[data-answer-feedback]"); page.click("[data-part=next]")
            page.wait_for_selector(".mission-result", timeout=15000)
            C.check("offline-resume-and-finish", "ongoing mission resumed and completed while offline", lambda: page.inner_text(".mission-result .kp-lead"))
            page.click("[data-part=next-mission]"); page.wait_for_selector(".kp-answer", timeout=15000)
            f = attempt()
            C.check("offline-next-mission-from-installed", "next mission created offline from an installed pack",
                    lambda: (f["journey"]["selection_trace"]["offline_filter"] is True and f["package_id"].startswith("MM-G01-L01-ADD-")) and f["package_id"] or (_ for _ in ()).throw(AssertionError(f["journey"]["selection_trace"])))
            page.evaluate("async()=>{const j=await import('./journey/journey.mjs');const s=await import('./data/store.js');await j.chooseStart(s.activeScope(),'S-G05-L01','test')}")
            page.goto(base + "#/map?all=1"); page.wait_for_selector(".map-stage")
            C.check("offline-not-downloaded-distinct", "open but not downloaded node says 'Belum diunduh'; locked nodes still say 'Belum terbuka'",
                    lambda: (page.locator("li.map-node.is-offline").count() >= 1 and page.locator("li.map-node.is-locked").count() >= 1 and
                             "Belum diunduh" in page.locator("li.map-node.is-offline").first.inner_text()) or (_ for _ in ()).throw(AssertionError(page.locator("li.map-node.is-offline").count())))
            # OFF-03: a cache clean-up (as after an update) must not break the active mission
            page.evaluate("""async()=>{for(const k of await caches.keys())if(k.includes(':ready-pack:'))await caches.delete(k);}""")
            page.goto(base + "#/session/" + f["attempt_id"]); page.reload(); page.wait_for_selector(".kp-answer", timeout=15000)
            page.fill(".kp-answer", ans(f["items"][0]["question"]["answer"])); page.keyboard.press("Enter"); page.wait_for_selector("[data-answer-feedback]")
            C.check("offline-active-mission-survives-cache-cleanup", "after pack caches are deleted the active mission still answers and saves offline",
                    lambda: attempt()["items"][0]["final_status"] == "correct" or (_ for _ in ()).throw(AssertionError()))
            server.network(True,ctx,args.engine)
            # DATA-01: a 1.3.0-style ongoing session (no flow policy) keeps its review step
            legacy = page.evaluate("""async()=>{const s=await import('./data/store.js'),st=await import('./player/start.mjs'),e=await import('./player/engine.mjs');
              const scope=s.activeScope();const cell=(await st.cells(2,1)).find(c=>c.operation==='ADD');const pkg=await st.open(cell.packages[0]);
              const a=e.createAttempt(pkg,scope,{mode:'practice',question_count:2,lang:'id'});delete a.flow_policy_version;await s.saveAttempt(a,null,scope);return a.attempt_id;}""")
            page.goto(base + "#/session/" + legacy); page.wait_for_selector(".kp-answer", timeout=15000)
            g = attempt()
            for k in range(2):
                page.fill(".kp-answer", ans(g["items"][k]["question"]["answer"])); page.keyboard.press("Enter"); page.wait_for_selector("[data-answer-feedback]")
                page.click("[data-part=next]")
            page.wait_for_selector("[data-part=finish]")
            C.check("legacy-13-session-keeps-review-step", "1.3-style session ends with its original review grid and submit",
                    lambda: (page.locator(".kp-map").count() == 1 and "Kirim hasil akhir" in page.inner_text("[data-part=finish]")) or (_ for _ in ()).throw(AssertionError(page.inner_text("main")[:300])))
            C.check("no-page-errors", "no uncaught errors", lambda: (not errors) or (_ for _ in ()).throw(AssertionError(errors[:3])))
            browser.close()
    except Exception as err:
        errors.append(traceback.format_exc())
        C.rows.append({"id":"finish-browser-flow","status":"FAIL","expected":"all UI actions complete",
                       "actual":type(err).__name__+": "+str(err)[:1500]})
    finally:
        server.close()
    build = {}
    try:
        build = {"offline_release": json.loads((ROOT / "dist" / "offline-assets.json").read_text())["release"],
                 "app_version": json.loads((ROOT / "dist" / "build-info.json").read_text())["app_version"]}
    except Exception:
        pass
    status = "PASS" if C.rows and all(r["status"] == "PASS" for r in C.rows) else "FAIL"
    body = {"schema": "kalibataku-qa-receipt/1", "suite": "journey-browser", "scope": "Adventure flow in "+args.engine+" (Playwright, headless; harness context bypasses CSP only so Playwright can poll the page — CSP itself is verified by the 1.3 header suites)",
            "build": build, "runtime": {"browser": args.engine, "version": engine_version, "executable": exe},
            "started": C.started, "finished": datetime.now(timezone.utc).isoformat(), "assertions": len(C.rows), "status": status,
            "errors": errors, "checks": C.rows, "screenshots": shots}
    Path(args.receipts).mkdir(parents=True, exist_ok=True)
    (Path(args.receipts) / ("journey-browser.json" if args.engine=="chromium" else f"journey-browser-{args.engine}.json")).write_text(json.dumps(body, indent=2) + "\n")
    failed = [r["id"] for r in C.rows if r["status"] != "PASS"]
    print(f"journey-browser: {status} · {len(C.rows)} assertions · {len(failed)} failed" + (" · " + ", ".join(failed) if failed else ""))
    sys.exit(0 if status == "PASS" else 1)


if __name__ == "__main__":
    main()
