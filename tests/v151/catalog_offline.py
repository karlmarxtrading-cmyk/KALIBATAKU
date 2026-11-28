"""AUD15-02. Exercise rendered offline claims and actions with a real worker and an unreachable origin."""
import argparse
import json
import os
from pathlib import Path
import sys
import traceback
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests/journey"))
from offline_origin import TestOrigin
from offline_capability import TEACH, FORM, NODE, OCC, catalog_install, offline_mode

GROUP = "grade=1&level=1&op=ADD"
CASES = ["healthy", "missing_package", "corrupt_package", "corrupt_shard", "corrupt_shell",
         "stale_version", "stale_release", "legacy_dependency", "assessment", "change_after_preview", "scoped_invalidation"]
LABEL = {"absent": "Belum diunduh", "update": "Perlu diperbarui", "repair": "Perlu perbaikan", "ready": "Tersedia offline"}
SAVE = {"absent": "Siapkan untuk offline", "update": "Perbarui salinan offline", "repair": "Perbaiki salinan offline"}


def route(origin, page, name):
    target=origin.url + "#/" + name
    if page.url!=target:
        page.goto(target)


def expect_state(container, state):
    label = container.locator(f'[data-package-state="{state}"]').first
    label.wait_for()
    assert LABEL[state] in label.inner_text(), label.inner_text()


def catalog(origin, page, pack, state, query=""):
    route(origin, page, "packs?" + GROUP + query)
    row = page.locator(f'.pack-row[href*="{pack}"]')
    expect_state(row, state)
    return row


def management(origin, page, pack, state):
    route(origin, page, "offline")
    card = page.locator(f'article[data-package-id="{pack}"]')
    expect_state(card, state)
    open_link = card.get_by_role("link", name="Buka latihan", exact=True)
    if state == "ready":
        assert open_link.is_visible() and pack in open_link.get_attribute("href")
    else:
        assert not open_link.count()
        repair = card.get_by_role("link", name=SAVE[state], exact=True)
        assert ("#/offline?" in repair.get_attribute("href") and pack in repair.get_attribute("href"))
        repair.click()
    detail_route = "offline?" + GROUP + "&pack=" + pack
    if page.url != origin.url + "#/" + detail_route:
        route(origin, page, detail_route)
    detail = page.locator(".data-body section.panel:has(> p[data-package-state])").first
    expect_state(detail, state)
    assert detail.get_by_role("link", name="Buka latihan", exact=True).count() == int(state == "ready")
    if state != "ready":
        detail.get_by_role("button", name=SAVE[state], exact=True).wait_for()


def count_attempts(page):
    return page.evaluate("""async()=>{const s=await import('./data/store.js');return (await s.listAttempts(s.activeScope())).length}""")


def begin(origin, page, pack, state):
    row = catalog(origin, page, pack, state)
    row.click()
    form = page.locator("form.setup")
    launch = form.locator("button[type=submit]")
    if state != "ready":
        expect_state(form, state)
        assert launch.is_disabled()
        assert pack in form.get_by_role("link", name="Kelola salinan offline").get_attribute("href")
        assert count_attempts(page) == 0
        return
    form.locator("button[type=submit]:enabled").click()
    page.locator(".kp-answer").wait_for()
    result = page.evaluate("""async()=>{const s=await import('./data/store.js');
        const a=await s.getAttempt(decodeURIComponent(location.hash.split('/')[2]),s.activeScope());return [a.package_id,a.mode]}""")
    assert result == [pack, "assessment" if pack == FORM else "practice"], result


def mutate(page, case, pack):
    return page.evaluate("""async ({kind,id,occ})=>{
      const db=await import('./data/db.js'),m=await import('./data/offline.js'),scope='offline:'+m.localURL('./').pathname;
      const row=(await db.transaction(['installs'],false,tx=>tx.all('installs',scope))).find(row=>row.data.id===id);
      const r=row.data;
      if(kind==='stale_version'||kind==='stale_release'){
        await db.transaction(['installs'],true,async tx=>{
          if(kind==='stale_version'){
            await tx.del('installs',row.key);r.version='0.9.0';await tx.put('installs',db.row(scope,r.id+'@'+r.version,r));
          }else{r.shellCache=r.shellCache.replace(/[a-f0-9]{16}$/,'0000000000000000');await tx.put('installs',row);}
        });return kind;
      }
      const cache=await caches.open(kind==='corrupt_shell'?r.shellCache:r.packCache);
      const path=kind==='corrupt_shell'?'player/engine.mjs':['corrupt_shard','legacy_dependency'].includes(kind)?occ:r.url;
      const url=m.localURL(path),body=await cache.match(url);if(!body)throw Error('seed missing '+path);
      if(['legacy_dependency','missing_package'].includes(kind)){
        if(!await cache.delete(url))throw Error('delete failed');
        if(kind==='legacy_dependency'){
          r.packUrls=r.packUrls.filter(u=>u!==url.href);r.dependencies=r.dependencies.filter(d=>(d.url||d)!==occ);
          await db.transaction(['installs'],true,tx=>tx.put('installs',row));
        }
      }else{const bytes=new Uint8Array(await body.arrayBuffer());bytes[0]^=1;await cache.put(url,new Response(bytes));}
      return url.pathname;
    }""", {"kind":case,"id":pack,"occ":OCC})


def fresh_offline(origin, ctx, page, engine, new_page):
    # A new tab has no decoded JS data from the installing/repairing document.
    # Keep the previous (fully rendered) document alive. Destroying a document
    # mid-request can generate a WebKit "Context is stopped" before the new
    # document even receives the offline navigation.
    page.locator(".app-view:not([aria-busy])").wait_for()
    page.locator("[data-package-state=checking]").first.wait_for(state="detached")
    offline_mode(ctx, page, origin, engine)
    fresh = new_page()
    route(origin, fresh, "packs?" + GROUP)
    fresh.locator(".app-view:not([aria-busy]) .pack-row").first.wait_for()
    assert fresh.evaluate("!!navigator.serviceWorker.controller")
    assert fresh.evaluate("performance.timeOrigin") != page.evaluate("performance.timeOrigin")
    return fresh


def scoped(origin, ctx, page):
    # Watch the real catalogue in one tab while editing installs using controls in another.
    observer = ctx.new_page()
    try:
        row = catalog(origin, observer, TEACH, "ready", "&q="+TEACH)
        page.bring_to_front()
        route(origin, page, "offline")
        card = page.locator(f'article[data-package-id="{TEACH}"]')
        expect_state(card, "ready")
        card.get_by_role("button", name="Hapus salinan offline").click()
        expect_state(row, "absent")
        catalog_install(page, origin.url, TEACH)
        expect_state(row, "ready")
        catalog_install(page, origin.url, FORM)
        observer.bring_to_front()
        observer.evaluate("""()=>{
          window.lookups=[];
          const match=Cache.prototype.match;
          Cache.prototype.match=function(request,...opts){lookups.push(new URL(request.url||request,document.baseURI).pathname);return match.call(this,request,...opts)};
          const observer=new MutationObserver(()=>{if(document.querySelector('[data-package-state=checking]'))window.checkingSeen=true});
          observer.observe(document.body,{childList:true,attributes:true,subtree:true});
        }""")
        route(origin, observer, "offline")
        expect_state(observer.locator(f'article[data-package-id="{FORM}"]'), "ready")
        observer.evaluate("window.lookups.length=0")
        catalog(origin, observer, TEACH, "ready", "&q="+TEACH)
        reads = observer.evaluate("window.lookups")
        assert observer.evaluate("window.checkingSeen") is True
        assert len([p for p in reads if p.endswith("/index.html")]) == 1, reads
        assert [p for p in reads if "/bank/v1.2/" in p] == [f"/bank/v1.2/g01/l01/{TEACH}.mjs"], reads
        observer.evaluate("window.lookups.length=0")
        filters=observer.locator("details.pack-filters");
        if not filters.evaluate("el=>el.open"):filters.locator("summary").click()
        observer.locator("[name=pack-search]").fill("")
        expect_state(observer.locator(f'.pack-row[href*="{FORM}"]'), "ready")
        reads = observer.evaluate("window.lookups")
        assert len([p for p in reads if p.endswith("/index.html")]) == 1
        assert set(p.split("/")[-1] for p in reads if "/bank/v1.2/" in p) == {TEACH+".mjs", FORM+".mjs"}
        return {"cross_tab_remove_install":True,"checking_visible":True,"filtered_pack_reads":1,"unfiltered_pack_reads":2,"shell_reads_per_cycle":1}
    finally:
        observer.close()


def cold_home(origin, page):
    # Registration is intentionally deferred until after home has rendered.
    # Activating the first worker cannot alter a connected home CTA. Replacing
    # this view caused two visible footer movements on the release candidate.
    page.add_init_script("""(()=>{
        const state=window.homeActivation={first:null,claim:0};
        new MutationObserver(()=>{
            const view=document.querySelector('.app-view[data-route=home]:not([aria-busy])');
            if(view?.querySelector('h1'))state.first??=view;
        }).observe(document,{subtree:true,attributes:true,childList:true});
        navigator.serviceWorker?.addEventListener('controllerchange',()=>state.claim++);
    })()""")
    route(origin,page,"")
    page.locator(".app-view[data-route=home]:not([aria-busy]) h1").wait_for()
    page.evaluate("""async()=>{
      await navigator.serviceWorker.ready;
      if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    }""")
    return page.evaluate("""()=>({claims:homeActivation.claim,retained:!!homeActivation.first&&homeActivation.first===document.querySelector('.app-view[data-route=home]')})""")


def run(browser, origin, engine, case):
    ctx = browser.new_context(viewport={"width":390,"height":844})
    errors = []
    def new_page():
        tab = ctx.new_page()
        tab.set_default_timeout(14000)
        tab.on("pageerror", lambda error: errors.append({"url":tab.url,"error":str(error),"stack":error.stack}))
        return tab
    page = new_page()
    pack = FORM if case == "assessment" else TEACH
    try:
        activation=cold_home(origin,page) if case=="healthy" else None
        if activation is not None:
            assert activation["retained"] and activation["claims"]==1, activation
        catalog(origin, page, pack, "absent")
        catalog_install(page, origin.url, pack)
        if case == "scoped_invalidation":
            facts=scoped(origin,ctx,page)
            assert not errors, errors
            return facts
        state = "update" if case.startswith("stale_") else "ready" if case in ["healthy","assessment","change_after_preview"] else "repair"
        changed = None
        if state != "ready":
            changed=mutate(page,case,pack)
        page=fresh_offline(origin,ctx,page,engine,new_page)
        catalog(origin,page,pack,state)
        management(origin,page,pack,state)
        route(origin,page,"map")
        mission = "ready" if state=="ready" and pack!=FORM else "repair"
        page.locator(f'.offline-mission [data-offline-state="{mission}"]').wait_for()
        if pack==FORM:
            assert "belum menyediakan materi" in page.locator(".offline-mission").inner_text()
        if case=="change_after_preview":
            route(origin,page,"session/new?"+GROUP+"&pack="+pack)
            submit=page.locator("form.setup button[type=submit]:enabled")
            submit.wait_for()
            changed=mutate(page,"corrupt_package",pack)
            submit.click()
            expect_state(page.locator("form.setup"),"repair")
            assert page.locator("form.setup button[type=submit]").is_disabled() and count_attempts(page)==0
            state="repair"
        else:
            begin(origin,page,pack,state)
        if state!="ready":
            origin.network(True,ctx,engine)
            management(origin,page,pack,state)
            page.locator(".data-body section.panel").first.get_by_role("button",name=SAVE[state],exact=True).click()
            page.get_by_text("Siap untuk latihan offline.",exact=True).wait_for(timeout=60000)
            assert page.evaluate("""async id=>(await(await import('./data/offline.js')).installRecords()).filter(r=>r.id===id).length""",pack)==1
            page=fresh_offline(origin,ctx,page,engine,new_page)
            management(origin,page,pack,"ready")
            begin(origin,page,pack,"ready")
        assert not errors, errors
        return {"id":pack,"first_worker_activation":activation,"mutation":changed,"catalog_and_device_and_detail":state,"initial_map":mission,
                "new_offline_document":True,"started_after_verified":True,"invalidations_before_launch":case=="change_after_preview",
                "repaired_then_reloaded":state!="ready","page_errors":errors}
    finally:
        origin.disconnected=False
        ctx.close()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--dist",type=Path,default=ROOT/"dist")
    parser.add_argument("--out",type=Path)
    parser.add_argument("--engine",choices=["chromium","firefox","webkit"],required=True)
    parser.add_argument("--case",choices=CASES)
    args=parser.parse_args()
    sid="catalog-offline-v151-"+args.engine
    out=args.out or Path(os.environ.get("KALIBATAKU_RECEIPTS",ROOT/"evidence/v151/new-tests"/args.engine))
    out.mkdir(exist_ok=True,parents=True)
    started=datetime.now(timezone.utc).isoformat()
    origin=TestOrigin(args.dist.resolve())
    checks=[];version=None
    try:
        with sync_playwright() as pw:
            exe=os.environ.get("CHROMIUM_PATH") if args.engine=="chromium" else None
            browser=getattr(pw,args.engine).launch(executable_path=exe)
            version=browser.version
            for case in ([args.case] if args.case else CASES):
                exp="Rendered catalogue, stored-pack list, detail and launch agree with verified material; only eligible teaching packs enable missions."
                try:
                    actual=run(browser,origin,args.engine,case);status="PASS"
                except Exception:
                    actual=traceback.format_exc(limit=6);status="FAIL"
                checks.append({"id":case,"expected":exp,"actual":actual,"status":status})
                print(case,status,flush=True)
                if status=="FAIL":print(actual,flush=True)
            browser.close()
    except Exception:
        checks.append({"id":"browser-runtime","expected":"Launch real browser","actual":traceback.format_exc(),"status":"BLOCKED_ENV"})
    finally:
        origin.close()
    build=json.loads((args.dist/"build-info.json").read_text())
    build["offline_release"]=json.loads((args.dist/"offline-assets.json").read_text())["release"]
    status="FAIL" if any(c["status"]=="FAIL" for c in checks) else "BLOCKED_ENV" if not version or any(c["status"]=="BLOCKED_ENV" for c in checks) else "PASS"
    result={"schema":"kalibataku-qa-receipt/1","suite":sid,"scope":"Catalogue, package management/detail, launcher, mission eligibility and bounded verification under true origin loss",
            "build":build,"engine":args.engine,"version":version,"started":started,"finished":datetime.now(timezone.utc).isoformat(),
            "assertions":len(checks),"status":status,"checks":checks}
    (out/(sid+".json")).write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
    return 0 if status=="PASS" else 1

if __name__=="__main__":
    raise SystemExit(main())
