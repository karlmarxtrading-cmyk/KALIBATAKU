"""Lab performance for the adventure flow (headless Chromium, local preview server).

Measures, over N fresh profiles (cold browser context each):
  * home JS: every script module loaded until the home CTA is visible (gzip -9 of dist bytes)
  * player addition: script modules first loaded after the CTA click until the question is ready
  * mission-ready time: CTA click -> answer box enabled (ms)
  * feedback latency: Enter -> feedback section visible (ms), every question of two missions
  * first-mission transfer: bytes of every resource fetched until the first question is ready
Budgets: home JS <= 150 KiB gzip; player addition (renderer included) <= 90 KiB gzip.
These are lab numbers on this machine, not field data (PERF-03 stays SETELAH_PILOT).
  python3 tests/journey/perf.py [--runs 5]
"""
import argparse, gzip, json, os, socket, statistics, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist"


def gz(path):
    return len(gzip.compress(path.read_bytes(), 9))


def pct(values, q):
    v = sorted(values)
    return v[min(len(v) - 1, max(0, round(q * (len(v) - 1))))]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--runs", type=int, default=5)
    ap.add_argument("--receipts", default=os.environ.get("KALIBATAKU_RECEIPTS", str(ROOT / "evidence" / "v14" / "receipts")))
    args = ap.parse_args()
    from playwright.sync_api import sync_playwright
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    server = subprocess.Popen([sys.executable, str(ROOT / "tools" / "preview.py"), "--port", str(port)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f"http://127.0.0.1:{port}/"
    runs = []
    try:
        time.sleep(0.8)
        with sync_playwright() as pw:
            exe = os.environ.get("CHROMIUM_PATH")
            browser = pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()
            for r in range(args.runs):
                ctx = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block", bypass_csp=True)
                page = ctx.new_page()
                page.goto(base); page.wait_for_selector("[data-cta=adventure]")
                def scripts():
                    return page.evaluate("performance.getEntriesByType('resource').map(e=>e.name)")
                home = [u for u in scripts() if u.endswith((".mjs", ".js"))]
                before = set(scripts())
                t0 = time.perf_counter(); page.click("[data-cta=adventure]")
                page.wait_for_selector(".kp-answer:not([readonly]):not([disabled])"); page.wait_for_function("!document.querySelector('fieldset')?.disabled")
                ready_ms = (time.perf_counter() - t0) * 1000
                after = scripts()
                player = [u for u in after if u not in before and u.endswith((".mjs", ".js"))]
                transfer = [u for u in after]
                lat = []
                for m in range(2):
                    a = page.evaluate("""async()=>{const id=decodeURIComponent(location.hash.split('/')[2]);const s=await import('./data/store.js');return await s.getAttempt(id,s.activeScope());}""")
                    for k in range(a["index"], len(a["items"])):
                        v = a["items"][k]["question"]["answer"]
                        page.fill(".kp-answer", v["numerator"] if v["denominator"] == "1" else v["numerator"] + "/" + v["denominator"])
                        t1 = time.perf_counter(); page.keyboard.press("Enter"); page.wait_for_selector("[data-answer-feedback]")
                        lat.append((time.perf_counter() - t1) * 1000)
                        page.click("[data-part=next]")
                    page.wait_for_selector(".mission-result")
                    if m == 0:
                        page.click("[data-part=next-mission]"); page.wait_for_selector(".kp-answer:not([readonly])")
                def local(u):
                    p = urlsplit(u).path.lstrip("/") or "index.html"
                    return DIST / p
                runs.append({"run": r + 1, "mission_ready_ms": round(ready_ms, 1), "feedback_ms": [round(x, 1) for x in lat],
                             "home_js": sorted({urlsplit(u).path for u in home}), "player_js": sorted({urlsplit(u).path for u in player}),
                             "home_js_gzip": sum(gz(local(u)) for u in set(home) if local(u).is_file()),
                             "player_js_gzip": sum(gz(local(u)) for u in set(player) if local(u).is_file()),
                             "first_mission_bytes": sum(local(u).stat().st_size for u in set(transfer) if local(u).is_file()),
                             "first_mission_gzip": sum(gz(local(u)) for u in set(transfer) if local(u).is_file())})
                ctx.close()
            browser.close()
    finally:
        server.terminate()
    ready = [x["mission_ready_ms"] for x in runs]; fb = [y for x in runs for y in x["feedback_ms"]]
    home_kib = max(x["home_js_gzip"] for x in runs) / 1024; player_kib = max(x["player_js_gzip"] for x in runs) / 1024
    checks = [
        {"id": "home-js-budget", "status": "PASS" if home_kib <= 150 else "FAIL", "expected": "<= 150 KiB gzip", "actual": round(home_kib, 1)},
        {"id": "player-js-budget", "status": "PASS" if player_kib <= 90 else "FAIL", "expected": "<= 90 KiB gzip", "actual": round(player_kib, 1)},
        {"id": "mission-ready-measured", "status": "PASS", "expected": "median and p95 reported (lab)", "actual": {"n": len(ready), "median_ms": statistics.median(ready), "p95_ms": pct(ready, .95)}},
        {"id": "feedback-latency-measured", "status": "PASS", "expected": "median and p95 reported (lab)", "actual": {"n": len(fb), "median_ms": round(statistics.median(fb), 1), "p95_ms": round(pct(fb, .95), 1)}},
        {"id": "first-mission-transfer-measured", "status": "PASS", "expected": "bytes to first question reported", "actual": {"raw_max": max(x["first_mission_bytes"] for x in runs), "gzip_max": max(x["first_mission_gzip"] for x in runs)}},
    ]
    status = "PASS" if all(c["status"] == "PASS" for c in checks) else "FAIL"
    build = json.loads((DIST / "offline-assets.json").read_text())["release"]
    body = {"schema": "kalibataku-qa-receipt/1", "suite": "journey-perf-lab", "scope": "Lab timing in headless Chromium on the build machine; not field data. Service worker blocked for cold loads.",
            "build": {"offline_release": build, "app_version": json.loads((DIST / "build-info.json").read_text())["app_version"]},
            "runtime": {"browser": "chromium", "executable": os.environ.get("CHROMIUM_PATH"), "runs": args.runs},
            "started": datetime.now(timezone.utc).isoformat(), "assertions": len(checks), "status": status, "errors": [], "checks": checks, "runs": runs}
    Path(args.receipts).mkdir(parents=True, exist_ok=True)
    (Path(args.receipts) / "journey-perf-lab.json").write_text(json.dumps(body, indent=2) + "\n")
    print(f"journey-perf-lab: {status} · home {home_kib:.1f} KiB · player {player_kib:.1f} KiB · ready median {statistics.median(ready):.0f} ms · feedback median {statistics.median(fb):.0f} ms p95 {pct(fb,.95):.0f} ms")
    sys.exit(0 if status == "PASS" else 1)


if __name__ == "__main__":
    main()
