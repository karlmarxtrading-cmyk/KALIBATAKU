"""Chromium profile downloads and restore of a synthetic 100,003-row recovery ZIP.

Run python3 tests/v15/backup-capacity-browser.py from the project root. Set
CHROMIUM_PATH to use a specific Chromium executable. Output is a JSON receipt.
"""
import argparse
import contextlib
import datetime
import functools
import hashlib
import http.server
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright


class QuietFiles(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def check(root):
    handler = functools.partial(QuietFiles, directory=str(root))
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        address = f"http://127.0.0.1:{server.server_port}/"
        try:
            root = Path(root)
            def identity():
                return {
                    "offline_release": json.loads((root / "offline-assets.json").read_bytes())["release"],
                    "backup_module_sha256": hashlib.sha256((root / "data/backup.js").read_bytes()).hexdigest(),
                    "ui_module_sha256": hashlib.sha256((root / "data/panel-profile.js").read_bytes()).hexdigest(),
                }
            tested = identity()
            receipt = check_download(address)
            assert tested == identity() and receipt["backup_module_sha256"] == tested["backup_module_sha256"]
            receipt["tested_dist"] = tested
            return receipt
        finally:
            server.shutdown()
            thread.join()


def check_download(address):
    with sync_playwright() as runner, tempfile.TemporaryDirectory() as temp:
        binary = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")
        with contextlib.ExitStack() as contexts:
            src = runner.chromium.launch_persistent_context(Path(temp) / "source", executable_path=binary,
                                                            accept_downloads=True, service_workers="block")
            version = src.browser.version
            contexts.callback(src.close)
            page = src.new_page()
            page.set_default_timeout(180_000)
            page.goto(address + "#/profiles")
            print("opening profiles", file=sys.stderr, flush=True)
            page.locator("input[type=file]").wait_for()
            print("seeding fixture", file=sys.stderr, flush=True)
            # Use the actual IndexedDB adapter and ledger, and keep the browser
            # contexts separate. Batching the fixture writes reduces IPC overhead.
            metadata = page.evaluate("""async () => {
              const store=await import('./data/store.js'),db=await import('./data/db.js');
              const {createAttempt,begin}=await import('./player/engine.mjs');
              const profile=await store.createProfile('Capacity browser'),scope=await store.selectLocalProfile(profile.id);
              const ns=store.scopeKey(scope);
              const level=await (await fetch('./bank/g03/l01.json')).json();
              const info=level.competencies[0].packages[0];
              const pkg=(await import('./'+info.url)).default;
              const a=createAttempt(pkg,scope,{mode:'practice',seed:79,question_count:4});
              await store.saveAttempt(a,begin(a),scope);
              for(let first=0;first<100001;first+=1000){
                await db.transaction(['records'],true,tx=>Promise.all(Array.from({length:Math.min(1000,100001-first)},(_,offset)=>{
                  const i=first+offset,id='r'+i;
                  return tx.put('records',db.row(ns,'case|'+id,{type:'case',id,value:i}));
                })));
              }
              return {id:a.attempt_id,profile:profile.id,impact:await store.profileImpact(profile.id)};
            }""")
            assert metadata["impact"] == {"sessions": 1, "events": 1, "records": 100001}
            print("seeded", file=sys.stderr, flush=True)
            page.reload()
            page.locator("input[type=file]").wait_for()
            legacy = page.locator("[data-legacy-backup]")
            legacy.locator("xpath=ancestor::details/summary").click()
            downloads = []
            page.on("download", lambda item: downloads.append(item.suggested_filename))
            print("legacy export", file=sys.stderr, flush=True)
            legacy.click()
            page.get_by_text("Profil melebihi batas JSON", exact=False).wait_for()
            assert downloads == []
            page.evaluate("(id)=>location.hash='/session/'+id", metadata["id"])
            box = page.locator(".kp-answer")
            print("opening session", file=sys.stderr, flush=True)
            box.wait_for()
            page.evaluate("""id=>{
              // Inject one quota signal into this disposable synthetic attempt.
              const put=IDBObjectStore.prototype.put;
              IDBObjectStore.prototype.put=function(value,...args){
                if(this.name==='attempts' && value.id===id){
                  IDBObjectStore.prototype.put=put;
                  throw new DOMException('Test quota','QuotaExceededError');
                }
                return put.call(this,value,...args);
              };
            }""", metadata["id"])
            box.fill("2/")
            rescue = page.locator("[data-rescue]")
            print("waiting for recovery control", file=sys.stderr, flush=True)
            rescue.wait_for()
            with page.expect_download(timeout=180_000) as capture:
                rescue.click()
            print("download received", file=sys.stderr, flush=True)
            download = capture.value
            assert download.suggested_filename.endswith(".zip")
            payload = Path(temp) / "recovery.zip"
            download.save_as(payload)
            build_info = page.evaluate("async()=>await(await fetch('./build-info.json')).json()")
            module_hash = page.evaluate("""async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch('./data/backup.js')).arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('')""")
            # A downloaded backup must be sufficient after the source browser
            # closes. Restore into another browser process and clean disk profile.
            src.close()
            dst = runner.chromium.launch_persistent_context(Path(temp) / "destination", executable_path=binary,
                                                            service_workers="block")
            contexts.callback(dst.close)
            restored = dst.new_page()
            restored.set_default_timeout(300_000)
            restored.goto(address + "#/profiles")
            restored.locator("input[type=file]").set_input_files(payload)
            confirm = restored.get_by_role("button", name="Pulihkan ke profil Capacity browser")
            print("waiting for valid preview", file=sys.stderr, flush=True)
            confirm.wait_for()
            assert restored.get_by_text("Termasuk satu draf jawaban").count() == 1
            print("committing archive", file=sys.stderr, flush=True)
            confirm.click()
            restored.get_by_text("Pemulihan selesai untuk Capacity browser", exact=False).wait_for()
            result = restored.evaluate("""async ({id,profile})=>{
              const store=await import('./data/store.js');
              const {row,key,transaction}=await import('./data/db.js');
              const scope=store.scopeForLocal(profile),ns=store.scopeKey(scope);
              const a=await store.getAttempt(id,scope),e=await store.listEvents(id,scope);
              const samples=await transaction(['records'],false,async t=>Promise.all([0,50000,100000].map(async i=>(await t.get('records',key(ns,'case|r'+i))).data.value)));
              return {impact:await store.profileImpact(profile),owner:a.profile_id===profile,draft:a.items[0].draft,dirty:a.items[0].dirty,
                status:a.status,event_types:e.map(v=>v.event_type),samples};
            }""", metadata)
            assert result["impact"] == metadata["impact"]
            assert result["owner"] and result["dirty"] and result["draft"] == "2/" and result["status"] == "ongoing"
            assert result["samples"] == [0, 50000, 100000] and len(result["event_types"]) == 1
            return {"status": "PASS", "command": "python3 tests/v15/backup-capacity-browser.py",
                    "time_utc": datetime.datetime.now(datetime.UTC).isoformat(), "engine": version,
                    "storage": "IndexedDB in two isolated, sequential persistent desktop browser contexts",
                    "build_info": build_info,
                    "backup_module_sha256": module_hash,
                    "legacy_oversize_downloads": 0, "legacy_limits_message": True, "recovery_download": "zip",
                    "bytes": payload.stat().st_size, "sha256": hashlib.file_digest(payload.open("rb"), "sha256").hexdigest(),
                    "preview_reported_draft": True, "restored": result}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist", type=Path, default=Path(__file__).resolve().parents[2] / "dist")
    opts = parser.parse_args()
    print(json.dumps(check(opts.dist.resolve()), ensure_ascii=False, indent=2))
