"""Observe early completion and the restored three-mission fixture in a fresh Firefox profile."""
import argparse
import hashlib
import json
import tempfile
import subprocess
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from offline_origin import TestOrigin

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--site", type=Path, default=root/"dist")
parser.add_argument("--out", type=Path, default=root/"evidence/v151/exposure/browser.json")
parser.add_argument("--fixture", type=Path, help="JSON backup produced by viewed-coverage.mjs for sparse-v150")
args = parser.parse_args()
args.out.parent.mkdir(exist_ok=True,parents=True)
site = args.site.resolve()
release = json.loads((site/"offline-assets.json").read_bytes())["release"]
origin = TestOrigin(site)
checks = []
started = datetime.now(timezone.utc).isoformat()
try:
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
        if args.fixture:
            fixture = args.fixture
        else:
            assert site == root/"dist"
            subprocess.run(["node","tests/journey/viewed-coverage.mjs","--dist",tmp],cwd=root,check=True)
            fixture = Path(tmp)/"sparse-profile.json"
        browser = pw.firefox.launch()
        version = browser.version
        context = browser.new_context(viewport={"width":390,"height":844})
        page = context.new_page()
        page.goto(origin.url)
        page.locator("[data-cta=adventure]").click()
        page.locator(".kp-answer").wait_for()
        attempt_id = page.url.split("#/session/")[1]
        page.reload()
        page.locator(".kp-answer").wait_for()
        page.locator("[data-part=review]").click()
        page.locator("[data-part=finish]").click()
        page.locator(".mission-result").wait_for()
        details=page.locator(".mission-result .result-journal")
        assert not details.evaluate("element=>element.open")
        details.locator("summary").click()
        result = page.locator(".mission-result").inner_text()
        assert "Soal dilihat · 1 / 6" in result and "Soal dijawab · 0 / 6" in result, result
        assert "soal unik dilihat 1/12" in result, result
        items = page.evaluate("""async id=>{
          const s=await import('./data/store.js'), a=await s.getAttempt(id,s.activeScope());
          return a.items.map(i=>({seen:i.seen,status:i.final_status,responses:i.history.length}));}""",attempt_id)
        assert sum(i["seen"] for i in items)==1 and sum(i["responses"] for i in items)==0
        assert sum(i["status"]=="unseen" for i in items)==5
        page.goto(origin.url+"#/map")
        early = page.locator(".map-node").first.inner_text()
        assert "soal unik dilihat 1/12" in early and "0/2" in early, early
        catalogue = page.evaluate("""async id=>{
          const s=await import('./data/store.js'),p=await import('./player/start.mjs');
          const a=await s.getAttempt(id,s.activeScope());
          const seen=new Set(a.items.filter(i=>i.seen).map(i=>i.question.fingerprint));
          const prepared=await p.prepareSession({lang:'id',signal:new AbortController().signal},{grade:1,level:1,
            operation:'ADD',mode:'practice',question_count:8,package_id:a.package_id});
          const expected=prepared.pkg.questions.filter(q=>!seen.has(q.fingerprint)).slice(0,8).map(q=>q.question_id);
          return {expected,actual:prepared.options.items.map(i=>i.question.question_id)};
        }""",attempt_id)
        assert len(catalogue["expected"]) == 8 and catalogue["actual"] == catalogue["expected"], catalogue
        checks.append({"case":"catalogue variation keeps allocated but unvisited questions available","selection":catalogue})
        checks.append({"case":"new intro ended on first displayed question after reload","items":items,"result":result,"map":early})
        context.close()
        context = browser.new_context(viewport={"width":390,"height":844})
        page = context.new_page()
        page.goto(origin.url)
        page.locator("[data-cta=adventure]").wait_for()
        installed = page.evaluate("""async backup=>{
          const b=await import('./data/backup.js'),s=await import('./data/store.js');
          const preview=await b.previewBackup(backup); await b.importBackup(backup);
          await s.selectLocalProfile(JSON.parse(backup).profile.id);return preview.sessions;}""",fixture.read_text())
        assert installed==3
        page.goto(origin.url+"#/map")
        page.reload()
        first = page.locator(".map-node").first
        sparse_map = first.inner_text()
        assert "soal unik dilihat 10/12" in sparse_map and "Misi target mandiri 2/2" in sparse_map, sparse_map
        assert "Siap lanjut" not in sparse_map, sparse_map
        assert page.locator(".map-node").nth(1).get_attribute("class").find("is-locked")>=0
        checks.append({"case":"restored sparse fixture, two passing missions, subtraction still locked","map":sparse_map,
                       "backup_sha256":hashlib.sha256(fixture.read_bytes()).hexdigest()})
        browser.close()
    args.out.write_text(json.dumps({"status":"PASS","offline_release":release,"runtime":"Firefox "+version,
      "started":started,"finished":datetime.now(timezone.utc).isoformat(),"checks":checks},indent=2,ensure_ascii=False)+"\n")
    print("PASS Firefox: early 1/12; restored sparse 10/12 and subtraction locked")
finally:
    origin.close()
