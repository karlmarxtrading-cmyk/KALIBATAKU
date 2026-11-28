"""AUD-02 / OFF-01 / OFF-04 and map reflow. Each installer starts in fresh browser storage."""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
from offline_origin import TestOrigin

NODE = "arithmetic.addition.g01.l01"
TEACH = "MM-G01-L01-ADD-P001"
FORM = "MM-G01-L01-ADD-P003"
OCC = "journey/v1/occ/" + NODE + ".json"


def stamp():
    return datetime.now(timezone.utc).isoformat()


def cache_inventory(page):
    return page.evaluate("""async()=>{const m=await import('./data/offline.js');
        return (await m.inspectInstalled()).map(r=>({id:r.id,state:r.state,cache:r.packCache}));}""")


def fresh_map(page, base):
    target = base + "#/map"
    if page.url != target:
        page.goto(target)
    rendered = page.locator(".app-view[data-route=map]:not([aria-busy]) .map-stage").first
    rendered.wait_for()
    previous_document = page.evaluate("performance.timeOrigin")
    page.reload()
    rendered.wait_for()
    assert page.evaluate("performance.timeOrigin") != previous_document
    return page.locator(".offline-mission [data-offline-state]")


def map_install(page):
    page.locator(".offline-mission button").click()
    page.locator(".offline-mission [data-offline-state=ready]").wait_for(timeout=60000)


def catalog_install(page, base, pack, repair=False):
    if not repair:
        target=base + "#/packs?grade=1&level=1&op=ADD"
        if page.url!=target:
            page.goto(target)
        page.locator(f".pack-row[href*='{pack}']").click()
        page.locator(".app-view:not([aria-busy]) form.setup button[type=submit]:enabled").wait_for()
        page.get_by_text("Atur latihan", exact=True).click()
        page.get_by_text("Rincian paket", exact=True).click()
        page.locator("form.setup a[href^='#/offline']").click()
    else:
        page.goto(base + "#/offline?grade=1&level=1&op=ADD&pack=" + pack)
    page.get_by_role("button", name="Perbaiki salinan offline" if repair else "Siapkan untuk offline", exact=True).click()
    page.get_by_text("Siap untuk latihan offline.", exact=True).wait_for(timeout=60000)


def verify_origin_down(page):
    assert page.evaluate("""async()=>{try{await fetch('/unavailable?network-check='+Date.now());return false}
        catch{return true}}""")


def offline_mode(ctx, page, origin, engine):
    origin.network(False, ctx, engine)
    if engine != "webkit":
        assert page.evaluate("navigator.onLine") is False
    verify_origin_down(page)


def load_snapshot(page, aid=None):
    return page.evaluate("""async aid=>{let s=await import('./data/store.js');
        return s.getAttempt(aid||decodeURIComponent(location.hash.split('/')[2]),s.activeScope())}""", aid)


def assert_mission_denied(page, base):
    page.goto(base + "#/mission?node=" + NODE + "&kind=intro")
    err = page.locator("[data-error-code]")
    err.wait_for()
    assert err.get_attribute("data-error-code") == "OFFLINE_REPAIR", err.inner_text()
    assert page.evaluate("""async()=>{const s=await import('./data/store.js');
            return (await s.listAttempts(s.activeScope())).length}""") == 0


def run_case(browser, origin, engine, scenario):
    base = origin.url
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    traced = scenario in {"legacy", "map"}
    if traced:
        ctx.add_init_script(path=Path(__file__).with_name("offline_legacy_diagnostics.js"))
    observations = {}
    page = ctx.new_page()
    page.set_default_timeout(14000)
    errors = []
    phase = "install"
    page.on("pageerror", lambda e: errors.append({"message":str(e), "stack":e.stack, "origin_down":origin.disconnected,
                                                   "phase":phase,"url":page.url}))
    try:
        page.goto(base)
        page.locator("[data-cta=adventure]").wait_for()
        assert not cache_inventory(page)
        if scenario == "map":
            assert fresh_map(page, base).get_attribute("data-offline-state") == "offline"
            map_install(page)
        else:
            catalog_install(page, base, FORM if scenario == "assessment" else TEACH)
        records = cache_inventory(page)
        assert len(records) == (2 if scenario == "map" else 1), records
        initial_packs = [r["id"] for r in records]
        if traced:
            observations["installed"] = records
        # Legacy records lack the occurrence URL in their receipt as well as in the cache.
        if scenario == "legacy":
            page.evaluate("""async ({path})=>{
                const db=await import('./data/db.js'),ns='offline:'+new URL('./',location).pathname;
                const [row]=await db.transaction(['installs'],false,tx=>tx.all('installs',ns));
                const r=row.data,url=new URL(path,document.baseURI).href,cache=await caches.open(r.packCache);
                if(!await cache.delete(url))throw Error('Missing legacy fixture dependency');
                r.packUrls=r.packUrls.filter(u=>u!==url);r.dependencies=r.dependencies.filter(d=>(d.url||d)!==path);
                await db.transaction(['installs'],true,tx=>tx.put('installs',row));}""", {"path": OCC})
        if scenario in ("corrupt_shard", "corrupt_package", "corrupt_shell"):
            page.evaluate("""async ({path,packageBody,shellFile})=>{
                const m=await import('./data/offline.js'),[r]=await m.inspectInstalled(),c=await caches.open(shellFile?r.shellCache:r.packCache);
                const url=packageBody?r.url:new URL(path,document.baseURI).href;
                const bytes=new Uint8Array(await (await c.match(url)).arrayBuffer());
                bytes[0]^=1;await c.put(url,new Response(bytes));
            }""", {"path":"player/engine.mjs" if scenario=="corrupt_shell" else OCC, "packageBody":scenario=="corrupt_package", "shellFile":scenario=="corrupt_shell"})
        if scenario == "stale":
            page.evaluate("""async()=>{const db=await import('./data/db.js'),ns='offline:'+new URL('./',location).pathname;
              await db.transaction(['installs'],true,async tx=>{const [r]=await tx.all('installs',ns);
                r.data.version='1.1.0';await tx.put('installs',r)})}""")
        phase = "offline map after initial installation"
        page.reload()
        page.locator(".app-view:not([aria-busy]) h1").first.wait_for()
        assert page.evaluate("!!navigator.serviceWorker.controller")
        offline_mode(ctx, page, origin, engine)
        label = fresh_map(page, base)
        bad = scenario not in ("map", "catalog")
        assert label.get_attribute("data-offline-state") == ("repair" if bad else "ready"), label.inner_text()
        assert page.locator("li.map-node.is-locked").count() > 0
        if bad:
            assert page.locator("li.map-node.is-repair").count() >= 1
            msg = label.inner_text()
            assert ("belum menyediakan materi" if scenario == "assessment" else "perlu diperbarui") in msg, msg
            if traced:
                observations["before_repair"] = label.get_attribute("data-offline-state")
            assert_mission_denied(page, base)
            phase = "online repair"
            origin.network(True, ctx, engine)
            if scenario == "legacy":
                catalog_install(page, base, TEACH, repair=True)
            else:
                fresh_map(page, base)
                map_install(page)
            # The installer and action are settled in this document. The next
            # reload occurs offline, exactly once, after the map is mounted.
            phase = "offline map after repair"
            offline_mode(ctx, page, origin, engine)
            assert fresh_map(page, base).get_attribute("data-offline-state") == "ready"
            if traced:
                observations["after_repair"] = cache_inventory(page)
        phase = "mission start"
        page.locator(f".map-node a[data-node='{NODE}']").click()
        page.locator(".kp-answer").wait_for()
        snapshot = load_snapshot(page)
        aid = snapshot["attempt_id"]
        refs = snapshot["journey"]["selected_occurrence_refs"]
        assert snapshot["journey"]["selection_trace"]["offline_filter"] is True
        assert len(refs) == 6 and snapshot["package_id"] != FORM
        if traced:
            observations.update(attempt_id=aid, initial_index=snapshot["index"], grades=[])
        for ix, item in enumerate(snapshot["items"]):
            phase = f"answer {ix+1}"
            answer = item["question"]["answer"]
            value = answer["numerator"] if answer["denominator"] == "1" else f"{answer['numerator']}/{answer['denominator']}"
            page.locator(".kp-answer:not([readonly])").fill(value)
            page.keyboard.press("Enter")
            page.locator("[data-answer-feedback] .verdict-tile.mine").wait_for()
            page.locator("[data-answer-feedback] .verdict-tile.key").wait_for()
            if traced:
                stored = load_snapshot(page, aid)
                row = stored["items"][ix]
                assert stored["index"] == ix and len(row["history"]) == 1 and row["feedback"] is True
                observations["grades"].append({"index": ix, "responses": len(row["history"]),
                    "committed": row["last_event_id"], "browser": page.evaluate("window.__legacyObservation()")})
            if ix == 0:
                if scenario == "map":
                    # Ongoing snapshots already contain the questions. Pack eviction
                    # must affect creation only and cannot replace or reorder the attempt.
                    page.evaluate("""async()=>{for(const key of await caches.keys())
                        if(key.includes(':ready-pack:'))await caches.delete(key)}""")
                phase = "resume the saved mission after a fresh document"
                page.goto(base + "#/")
                page.locator(".app-view[data-route=home]:not([aria-busy]) [data-cta=adventure]").wait_for()
                page.reload()
                page.locator("[data-cta=adventure]").click()
                page.locator("[data-answer-feedback]").wait_for()
                after = load_snapshot(page)
                assert after["attempt_id"] == aid and after["journey"]["selected_occurrence_refs"] == refs
            page.locator("[data-part=next]").click()
        page.locator(".mission-result").wait_for()
        final = load_snapshot(page, aid)
        events = page.evaluate("""async id=>{let s=await import('./data/store.js');return s.listEvents(id,s.activeScope())}""", aid)
        assert final["status"] == "completed" and len([e for e in events if e["event_type"] == "attempt.completed"]) == 1
        assert not errors, errors
        if traced:
            submissions = [e["event_id"] for e in events if e["event_type"] == "answer.submitted"]
            assert len(submissions) == len(refs) == len(set(submissions))
            observations["response_events"] = submissions
            observations["final_status"] = final["status"]
        return {"installed": initial_packs, "material_repaired": bad, "pack_played": final["package_id"],
                "items": len(refs), "retained_after_reload": True, "final_commits": 1,
                "network_probe_failed": True, "evicted_after_start": scenario == "map",
                **({"interaction_trace": observations} if traced else {})}
    except Exception as exc:
        if traced:
            observations["phase"] = phase
            observations["errors"] = errors
            try:
                current = load_snapshot(page, observations.get("attempt_id"))
                if current:
                    observations["stored"] = {"index": current["index"], "ready": current["ready"],
                        "items": [{"draft": item["draft"], "responses": len(item["history"]),
                                   "feedback": item["feedback"]} for item in current["items"]]}
                observations["visible_text"] = page.locator("main").inner_text(timeout=1000)[-1400:]
            except Exception as storage_error:
                observations["storage_capture_error"] = str(storage_error)
            try:
                observations["last_browser_state"] = page.evaluate("window.__legacyObservation()")
            except Exception as capture_error:
                observations["capture_error"] = str(capture_error)
            raise AssertionError(json.dumps(observations, ensure_ascii=False)) from exc
        raise
    finally:
        origin.disconnected = False
        ctx.close()


def bootstrap_repair(browser, origin, engine):
    # Start a new document after corruption of the entry module. This bypasses
    # all UI modules from the former JS realm and tests repair by the worker.
    ctx=browser.new_context()
    try:
        p=ctx.new_page()
        p.goto(origin.url+'#/map')
        map_install(p)
        p.reload()
        p.locator('.map-stage').first.wait_for()
        assert p.evaluate("!!navigator.serviceWorker.controller")
        await_entry = """async()=>{const m=await import('./data/offline.js'),[r]=await m.inspectInstalled();
          const cache=await caches.open(r.shellCache),url=new URL('app.mjs',document.baseURI).href;
          const bytes=new Uint8Array(await (await cache.match(url)).arrayBuffer());
          bytes[0]^=1;await cache.put(url,new Response(bytes,{headers:{'Content-Type':'text/javascript'}}));
          return r.shellCache;}"""
        cache_name=p.evaluate(await_entry)
        # Exercise the worker's own response to an unreachable origin. A protocol-level
        # offline override can short-circuit this fetch in Firefox before the worker runs.
        origin.disconnected=True
        verify_origin_down(p)
        # The bad bytes must not be served, even to a separate script request.
        blocked=p.evaluate("""async()=>{let r=await fetch(new URL('app.mjs',document.baseURI));
            return {status:r.status,body:await r.text()}}""")
        assert blocked['status']==503 and 'Reconnect' in blocked['body'], blocked
        origin.network(True,ctx,engine)
        page=ctx.new_page()
        page.goto(origin.url+'#/map')
        page.locator('.map-stage').first.wait_for()
        digest=page.evaluate("""async name=>{const cache=await caches.open(name),u=new URL('app.mjs',document.baseURI),
          index=await (await cache.match(new URL('offline-assets.json',document.baseURI))).json(),
          bytes=await (await cache.match(u)).arrayBuffer();const {sha256}=await import('./data/common.js');
          return {expected:index.assets.find(a=>a.path==='app.mjs').sha256,actual:await sha256(bytes)};}""",cache_name)
        assert digest['expected']==digest['actual']
        offline_mode(ctx,page,origin,engine)
        assert fresh_map(page,origin.url).get_attribute('data-offline-state')=='ready'
        return {'networkless_corrupt_entry_status':blocked['status'],'fresh_document_module_sha256':digest['actual'],
                'offline_reload_after_repair':True}
    finally:
        origin.disconnected=False
        ctx.close()


def map_reflow(browser, base):
    ctx = browser.new_context()
    try:
        page = ctx.new_page()
        page.goto(base + "#/map")
        page.locator(".map-stage").first.wait_for()
        result = []
        # 1280 / 4 = 320 CSS px is the WCAG desktop 400%-zoom reflow equivalent.
        # The separate text-only check verifies a real 2x computed root font.
        for width, percent in [(1440, 100), (768, 100), (320, 100), (320, 200)]:
            page.set_viewport_size({"width": width, "height": 720})
            size = page.evaluate("""p=>{document.documentElement.style.setProperty('font-size',p+'%','important');
                return parseFloat(getComputedStyle(document.documentElement).fontSize)}""", percent)
            assert size >= 16 * percent / 100
            dims = page.evaluate("""()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
                controls:[...document.querySelectorAll('main :is(a,button,summary)')].filter(x=>x.offsetHeight).map(x=>{
                    let r=x.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}})})""")
            assert dims["scrollWidth"] <= width + 1
            assert all(c["width"] > 0 and c["left"] >= -1 and c["right"] <= width + 1 for c in dims["controls"]), dims
            link = page.locator(".map-node a[data-node]").first
            link.focus()
            assert link.evaluate("el=>el===document.activeElement")
            result.append({"css_viewport": width, "root_font_px": size, "scroll_width": dims["scrollWidth"], "visible_actions": len(dims["controls"])})
        return result
    finally:
        ctx.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", choices=["chromium", "firefox", "webkit"], default="chromium")
    parser.add_argument("--dist", type=Path, default=ROOT / "dist")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--case", choices=["map","catalog","legacy","assessment","stale","corrupt_shard","corrupt_package","corrupt_shell","bootstrap_repair","map_reflow"])
    args = parser.parse_args()
    dist = args.dist.resolve()
    out = args.out or Path(os.environ.get("KALIBATAKU_RECEIPTS", ROOT / "evidence/v15/offline")) / f"offline-capability-{args.engine}.json"
    server = TestOrigin(dist)
    base = server.url
    checks = []
    version = None
    started = stamp()
    try:
        with sync_playwright() as pw:
            exe = os.getenv("CHROMIUM_PATH") if args.engine == "chromium" else None
            browser = getattr(pw, args.engine).launch(executable_path=exe)
            version = browser.version
            for case in ([args.case] if args.case else ["map","catalog","legacy","assessment","stale","corrupt_shard","corrupt_package","corrupt_shell","bootstrap_repair","map_reflow"]):
                expected = ("All map actions fit and accept focus at desktop, tablet and narrow widths including a 200% font." if case == "map_reflow"
                            else "Actual map capability matches launch. Complete or repaired material supports fresh offline start, feedback, resume and final commit.")
                try:
                    if case=="bootstrap_repair":
                        expected="Offline entry-module corruption yields 503. A fresh online document rehydrates the exact module; the corrected app then reloads offline."
                        result=bootstrap_repair(browser,server,args.engine)
                    elif case=="map_reflow":
                        result=map_reflow(browser,base)
                    else:
                        result=run_case(browser,server,args.engine,case)
                    checks.append(dict(id=case, status="PASS", expected=expected, actual=result))
                except Exception as exc:
                    import traceback
                    checks.append(dict(id=case,status="FAIL",expected=expected,actual=traceback.format_exc(limit=4)))
                print(case, checks[-1]["status"], flush=True)
            browser.close()
    except Exception as exc:
        checks.append(dict(id="browser-runtime",status="BLOCKED_ENV",expected="Launch browser",actual=str(exc)))
    finally:
        server.close()
    status = "FAIL" if any(c["status"]=="FAIL" for c in checks) else "BLOCKED_ENV" if not version else "PASS"
    build = json.loads((dist/"build-info.json").read_text())
    build["offline_release"] = json.loads((dist/"offline-assets.json").read_text())["release"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"schema":"kalibataku-qa-receipt/1","suite":"offline-capability-"+args.engine,"scope":"Journey offline installers and map reflow on localhost; desktop browser automation",
      "started":started,"finished":stamp(),"build":build,"engine":args.engine,"version":version,"status":status,"assertions":len(checks),"checks":checks},indent=2,ensure_ascii=False)+"\n")
    return 0 if status=="PASS" else 1

if __name__ == "__main__":
    raise SystemExit(main())
