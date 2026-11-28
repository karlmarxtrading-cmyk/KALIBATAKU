"""Repeat both offline installation paths in six independent Firefox processes."""
import argparse
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests/journey"))
from offline_capability import TestOrigin, run_case, stamp


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    dist = ROOT / "dist"
    checks = []
    started = stamp()
    with sync_playwright() as playwright:
        for number, scenario in enumerate(("map", "legacy") * 3, 1):
            server = TestOrigin(dist)
            browser = playwright.firefox.launch()
            version = browser.version
            try:
                actual = run_case(browser, server, "firefox", scenario)
                status = "PASS"
            except Exception as exc:
                import traceback
                actual = traceback.format_exc()
                status = "FAIL"
            finally:
                server.close()
                browser.close()
            checks.append({"id": f"cold-{scenario}-{number}", "status": status,
                           "expected": "Teardown between runs. Six persisted grades, six distinct response events and one completion offline, including after repair for legacy installs.",
                           "actual": actual})
            print(f"Cold Firefox {scenario} {number}: {status}", flush=True)
    passed = all(row["status"] == "PASS" for row in checks)
    build = json.loads((dist / "build-info.json").read_bytes())
    build["offline_release"] = json.loads((dist / "offline-assets.json").read_bytes())["release"]
    receipt = {"schema":"kalibataku-qa-receipt/1", "suite":"offline-legacy-repeat-firefox",
               "scope":"Localhost map plus legacy installation and repair. Cold offline missions in desktop Firefox.",
               "engine":"firefox", "version":version, "build":build, "started":started, "finished":stamp(),
               "status":"PASS" if passed else "FAIL", "assertions":len(checks), "checks":checks}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
