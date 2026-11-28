"""AUD-03. Exercise the actual starting-point chooser, session, IndexedDB and reload."""
import argparse
import json
import os
import threading
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright


class StaticSite(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def simultaneous(pages, action, args):
    for page, argument in zip(pages, args):
        page.evaluate("""argument => {
          const start = new BroadcastChannel('test-start-choice');
          window.choiceResult = new Promise((resolve, reject) => {
            start.onmessage = () => { start.close(); act(argument).then(resolve, reject); };
          });
          const act = """ + action + "; }", argument)
    pages[0].evaluate("() => { const c = new BroadcastChannel('test-start-choice'); c.postMessage('go'); c.close(); }")
    return [page.evaluate("window.choiceResult") for page in pages]


def run(base, browser, cases):
    ctx = browser.new_context(service_workers="block")
    p = ctx.new_page()
    p.set_default_timeout(15000)

    def check(label, expected, actual):
        case = dict(id=label, expected=expected, actual=actual, status="PASS" if actual == expected else "FAIL")
        cases.append(case)
        assert actual == expected, case

    def current():
        return p.evaluate("""async () => {
            const s = await import('./data/store.js');
            return s.getAttempt(decodeURIComponent(location.hash.split('/')[2]), s.activeScope());
        }""")

    def choose(grade):
        p.goto(base + "#/start-point")
        p.wait_for_selector(".start-stage", state="attached")
        group = p.locator(".start-grade").nth(grade - 1)
        if group.get_attribute("open") is None:
            group.locator("summary").click()
        group.locator(".start-stage").first.click()

    def finish_wrong():
        attempt = current()
        for item in attempt["items"]:
            q = item["question"]["answer"]
            wrong = int(q["numerator"]) + int(q["denominator"])
            p.locator(".kp-answer:not([readonly])").fill(f"{wrong}/{q['denominator']}")
            p.keyboard.press("Enter")
            p.wait_for_selector("[data-answer-feedback]")
            p.locator("[data-part=next]").click()
        p.wait_for_selector(".mission-result")
        return current()

    p.goto(base)
    p.locator("[data-cta=adventure]").click()
    p.wait_for_selector(".kp-answer")
    failed = finish_wrong()
    check("baseline fixture in browser", ["completed", 0, 6],
          [failed["status"], sum(i["history"][0]["is_correct"] for i in failed["items"]), len(failed["items"])])
    choose(5)
    p.wait_for_selector(".kp-answer")
    active = current()
    check("failed G1 followed by selected G5", ["S-G05-L01", "intro", 1],
          [active["journey"]["stage_id"], active["journey"]["mission_kind"], active["journey"]["start_intent_step"]])
    active_id = active["attempt_id"]
    frozen_refs = active["journey"]["selected_occurrence_refs"]
    p.locator(".kp-answer").fill("17")
    p.wait_for_function("""async id => {
       const s=await import('./data/store.js'); return (await s.getAttempt(id,s.activeScope())).items[0].draft==='17';
    }""", arg=active_id)
    choose(7)
    p.wait_for_selector("[data-cta=adventure]")
    check("deferred choice explained on home", True, "Kelas 7" in p.inner_text(".lesson-reason"))
    p.reload()
    p.wait_for_selector("[data-cta=adventure]")
    check("reload keeps original session as primary action", "#/session/" + active_id, p.locator("[data-cta=adventure]").get_attribute("href"))
    p.locator("[data-cta=adventure]").click()
    p.wait_for_selector(".kp-answer")
    check("draft after reload and stage change", "17", p.locator(".kp-answer").input_value())
    check("all frozen occurrence refs unchanged", True, current()["journey"]["selected_occurrence_refs"] == frozen_refs)
    finish_wrong()
    p.locator("[data-part=next-mission]").click()
    p.wait_for_selector(".kp-answer")
    resumed = current()
    check("first mission after final commit follows deferred G7 choice", ["S-G07-L01", 1],
          [resumed["journey"]["stage_id"], resumed["journey"]["start_intent_step"]])
    preserved = p.evaluate("""async id => {
        const s = await import('./data/store.js'); return s.getAttempt(id,s.activeScope());
    }""", failed["attempt_id"])
    check("old completed G1 snapshot, every field preserved", True, preserved == failed)
    # Different dates and simultaneous tabs must use the commit order, with two distinct revisions.
    q = ctx.new_page()
    q.goto(base)
    q.wait_for_selector("[data-cta=adventure]")
    write = """async grade=>{
        const j=await import('./journey/journey.mjs'),s=await import('./data/store.js');
        return j.chooseStart(s.activeScope(),'S-G'+grade+'-L01','learner_choice');
    }"""
    writes = simultaneous([p, q], write, ["09", "10"])
    latest = max(writes, key=lambda choice: choice["revision"])
    stored = q.evaluate("""async () => {
       const j=await import('./journey/journey.mjs'),s=await import('./data/store.js');
       return j.startPoint(s.activeScope());
    }""")
    check("two-tab IndexedDB writes", [3, 4], sorted(w["revision"] for w in writes))
    check("both tabs observe latest committed intent", [latest["stage_id"], latest["intent_id"]],
          [stored["stage_id"], stored["intent_id"]])
    ctx.close()
    ctx = browser.new_context(service_workers="block")
    tabs = [ctx.new_page(), ctx.new_page()]
    for tab in tabs:
        tab.goto(base)
        tab.wait_for_selector("[data-cta=adventure]")
    tabs[0].evaluate(write, "05")
    launch = """async () => {
        const j = await import('./journey/journey.mjs'), s = await import('./data/store.js');
        const scope = s.activeScope(), signal = new AbortController().signal;
        return j.createMission({scope, signal, lang:'id'}, {nodeId:'arithmetic.addition.g05.l01',kind:'intro'});
    }"""
    ids = simultaneous(tabs, launch, [None, None])
    count = tabs[0].evaluate("""async () => {
        const s=await import('./data/store.js'); return (await s.listAttempts(s.activeScope())).length;
    }""")
    check("two tabs launching the same choice return one saved mission", [True, 1], [ids[0] == ids[1], count])
    ctx.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist", type=Path, default=Path("dist"))
    parser.add_argument("--out", type=Path, default=Path("evidence/v15/intent/browser.json"))
    parser.add_argument("--browser", choices=("chromium", "firefox", "webkit"), default="chromium")
    args = parser.parse_args()
    site = args.dist.resolve()
    handler = partial(StaticSite, directory=str(site))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    base = f"http://127.0.0.1:{server.server_port}/"
    report = {"suite": "AUD-03 start intent, desktop browser + IndexedDB", "browser": args.browser,
              "shell_release": json.loads((site / "offline-assets.json").read_bytes())["release"],
              "time": datetime.now(timezone.utc).isoformat(), "cases": []}
    try:
        with sync_playwright() as pw:
            options = {}
            if args.browser == "chromium" and os.getenv("CHROMIUM_PATH"):
                options["executable_path"] = os.environ["CHROMIUM_PATH"]
            b = getattr(pw, args.browser).launch(**options)
            report["browser_version"] = b.version
            run(base, b, report["cases"])
            b.close()
        report["status"] = "PASS"
    except Exception as exc:
        report.update(status="FAIL", error=str(exc))
        raise
    finally:
        server.shutdown()
        server.server_close()
        t.join()
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(report["status"], len(report["cases"]), args.out)


if __name__ == "__main__":
    main()
