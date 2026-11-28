"""Exercise Firefox's native per-site full zoom at 400% in an isolated, disposable profile."""
import json
import os
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from playwright.sync_api import sync_playwright
from offline_origin import TestOrigin

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "dist"
SERVER_WIDTH = 1280


def set_site_zoom(profile, factor):
    # Firefox keeps the zoom setting for each host in content-prefs.sqlite.
    # Close the entire browser before writing only to this test profile.
    with sqlite3.connect(Path(profile) / "content-prefs.sqlite") as db:
        db.execute("INSERT OR IGNORE INTO groups(name) VALUES (?)", ("127.0.0.1",))
        db.execute("INSERT OR IGNORE INTO settings(name) VALUES (?)", ("browser.content.full-zoom",))
        group = db.execute("SELECT id FROM groups WHERE name=?", ("127.0.0.1",)).fetchone()[0]
        setting = db.execute("SELECT id FROM settings WHERE name=?", ("browser.content.full-zoom",)).fetchone()[0]
        db.execute("DELETE FROM prefs WHERE groupID=? AND settingID=?", (group, setting))
        db.execute("INSERT INTO prefs(groupID,settingID,value,timestamp) VALUES(?,?,?,?)",
                   (group, setting, factor, int(time.time() * 1000)))


def measure(pw, profile, base, factor):
    ctx = pw.firefox.launch_persistent_context(profile, viewport={"width": SERVER_WIDTH, "height": 720})
    try:
        page = ctx.pages[0]
        if factor == 1:
            # Keep the real first registration pending until the user has
            # focused a map control. Other timing can hide a destructive redraw.
            page.add_init_script("""(()=>{
                const sw=navigator.serviceWorker, register=sw.register.bind(sw);
                const gate=new Promise(resolve=>window.allowFirstRegistration=resolve);
                sw.register=async(...args)=>{await gate;return register(...args)};
            })()""")
        page.goto(base + "#/map")
        page.locator(".map-stage").first.wait_for()
        data = page.evaluate("""()=>({css_viewport:innerWidth, scroll_width:document.documentElement.scrollWidth,
          root_px:parseFloat(getComputedStyle(document.documentElement).fontSize),
          actions:[...document.querySelectorAll('main a, main button, main summary')].filter(x=>x.offsetHeight).map(x=>{
            let b=x.getBoundingClientRect();return {name:x.textContent.trim(),left:b.left,right:b.right};
          })})""")
        assert data["css_viewport"] == SERVER_WIDTH / factor, data
        assert data["scroll_width"] <= data["css_viewport"] + 1
        assert all(a["left"] >= -1 and a["right"] <= data["css_viewport"] + 1 for a in data["actions"])
        action = page.locator(".map-node a[data-node]").first
        action.focus()
        assert action.evaluate("el=>el===document.activeElement")
        if factor == 1:
            data["first_worker_claim_kept_focus"]=action.evaluate("""async el=>{
                const sw=navigator.serviceWorker;
                if(sw.controller)throw Error('Expected a fresh uncontrolled profile');
                const claim=new Promise((resolve,reject)=>{
                    const timer=setTimeout(()=>reject(Error('Worker did not claim the map')),15000);
                    sw.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve()},{once:true});
                });
                window.allowFirstRegistration();await claim;
                await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                return el.isConnected&&el===document.activeElement&&!!sw.controller;
            }""")
            assert data["first_worker_claim_kept_focus"]
        if factor == 4:
            page.keyboard.press("Enter")
            page.locator(".kp-answer").wait_for()
            data["used_map_action_to_start_mission"] = True
        return data, ctx.browser.version
    finally:
        ctx.close()


def main():
    expected = "With the same 1280-px window, native 4x zoom yields a 320 CSS-px viewport; the map fits and keyboard activation starts a real mission."
    result = {"started":datetime.now(timezone.utc).isoformat(), "schema":"kalibataku-qa-receipt/1", "suite":"firefox-map-native-zoom",
              "scope":"Native per-host desktop Firefox full zoom, isolated test profile on localhost", "checks":[]}
    server = TestOrigin(SITE)
    try:
        with TemporaryDirectory() as profile, sync_playwright() as pw:
            normal, version = measure(pw,profile,server.url,1)
            set_site_zoom(profile,4)
            zoomed, _ = measure(pw,profile,server.url,4)
            result["runtime"] = {"browser":"firefox","version":version}
            result["checks"].append({"id":"native-map-400pct","expected":expected,"status":"PASS",
                                      "actual":{"before":normal,"after":zoomed,"site_full_zoom":4.0}})
    except Exception:
        import traceback
        result["checks"].append({"id":"native-map-400pct","expected":expected,"status":"FAIL","actual":traceback.format_exc(limit=5)})
    finally:
        server.close()
    result["status"] = result["checks"][0]["status"]
    result["assertions"] = len(result["checks"])
    result["finished"] = datetime.now(timezone.utc).isoformat()
    result["build"] = json.loads((SITE/"build-info.json").read_text())
    result["build"]["offline_release"] = json.loads((SITE/"offline-assets.json").read_text())["release"]
    folder = Path(os.environ.get("KALIBATAKU_RECEIPTS", ROOT/"evidence/v15/offline/firefox"))
    folder.mkdir(parents=True,exist_ok=True)
    (folder/"map-native-zoom.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
    print("Firefox native map 400%:",result["status"])
    return 0 if result["status"]=="PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
