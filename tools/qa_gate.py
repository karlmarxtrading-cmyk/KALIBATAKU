"""KALIBATAKU production QA gate: `npm run qa:production`.

Copies the project into a temporary sandbox (dist is hard-linked read-only), runs every
suite registered in tests/qa/suites.json there, validates exit codes, assertion counts,
receipts and build identity, and writes evidence/v162/qa/<suite>/ plus binding.json.
The binding is then verified again from disk exactly as the assessor will verify it.
Exit status: 0 only when every required suite is PASS (environment-blocked suites that
are allowed to be blocked are reported as BLOCKED_ENV and keep their gates open).
Historical evidence in the repository is never modified by this command.
"""
import argparse, json, os, shutil, sys, tempfile, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).resolve().parent))
import qa_core

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / 'tests/qa/suites.json'
OUT = ROOT / 'evidence/v162/qa'
COPY = ('.github','src', 'spec', 'tests', 'tools', 'factory', 'docs', 'evidence', 'VALIDASI_EKSTERNAL')
FILES = ('package.json', 'package-lock.json', 'requirements-qa.txt', '.python-version', '.nvmrc', '.gitattributes', 'FILE_INVENTORY.json', 'SHA256SUMS', 'RELEASE_STATUS.json')
ROOT_DOCS = ('*.md', '*.txt', '*.html', 'REGISTER*.csv')


def sandbox():
    work = Path(tempfile.mkdtemp(prefix='kalibataku-qa-', dir=os.environ.get('KALIBATAKU_QA_WORKDIR')))
    for name in COPY:
        if (ROOT / name).exists():
            shutil.copytree(ROOT / name, work / name, ignore=shutil.ignore_patterns('__pycache__', 'qa', 'receipts') if name == 'evidence' else shutil.ignore_patterns('__pycache__'))
    # Operator documentation and the immutable old registers are themselves acceptance inputs.
    for pattern in ROOT_DOCS:
        for item in ROOT.glob(pattern):
            shutil.copy2(item, work / item.name)
    for name in FILES:
        if (ROOT / name).is_file():
            shutil.copy2(ROOT / name, work / name)
    try:
        shutil.copytree(ROOT / 'dist', work / 'dist', copy_function=os.link)
    except OSError:
        # copytree may already have populated directories or linked a prefix.
        shutil.rmtree(work / 'dist', ignore_errors=True)
        shutil.copytree(ROOT / 'dist', work / 'dist')
    return work


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='', help='comma-separated suite ids (diagnostic run; never a release binding)')
    ap.add_argument('--out', type=Path, default=OUT)
    ap.add_argument('--keep', action='store_true')
    ap.add_argument('--parallel', action='store_true', help='Run independent Chromium and Firefox suites in two additional isolated checkouts. Memory-intensive and performance tests run serially.')
    a = ap.parse_args()
    # Hash exactly the registry bytes this run uses; an edit during the run cannot be adopted.
    registry_bytes = REGISTRY.read_bytes()
    registry = json.loads(registry_bytes)
    registry_sha = qa_core.sha256_bytes(registry_bytes)
    suites = registry['suites']
    diagnostic = bool(a.only)
    if diagnostic:
        wanted = set(a.only.split(','))
        suites = [s for s in suites if s['id'] in wanted]
        unknown = wanted - {s['id'] for s in suites}
        if unknown:
            print('unknown suites', unknown, file=sys.stderr); return 2
    out = a.out.resolve() if not diagnostic else Path(tempfile.mkdtemp(prefix='kalibataku-qa-diag-'))
    if not diagnostic and out != OUT:
        if out.is_relative_to(ROOT) or ROOT.is_relative_to(out) or (out.exists() and (not out.is_dir() or any(out.iterdir()))):
            ap.error('--out must identify an empty external directory or the canonical QA evidence directory')
    ident = qa_core.identity(ROOT)
    rt = qa_core.runtime()
    print('build', json.dumps(ident), '\nruntime', json.dumps(rt), flush=True)
    if not ident.get('app_version') or not ident.get('bank_version'):
        print('dist/build-info.json missing: run npm run build first', file=sys.stderr); return 2
    work = sandbox()
    before = qa_core.identity(work)
    if before['dist_tree_sha256'] != ident['dist_tree_sha256']:
        print('sandbox distribution differs from repository', file=sys.stderr); return 2
    staging = Path(tempfile.mkdtemp(prefix='kalibataku-qa-out-', dir=os.environ.get('KALIBATAKU_QA_WORKDIR')))
    worker = sandbox() if a.parallel else None
    firefox_worker = sandbox() if a.parallel else None
    def run_group(group, checkout):
        observed = []
        for spec in group:
            t = time.monotonic()
            r = qa_core.run_suite(spec, checkout, staging, ident)
            observed.append(r)
            print(f"[{r['status']:<11}] {spec['id']:<34} {r['assertions']:>7} assertions {time.monotonic()-t:7.1f}s" +
                  (f"  {r['problems'][:3]}" if r['problems'] else ''), flush=True)
        return observed
    try:
        if worker:
            if any(qa_core.identity(checkout) != ident for checkout in (worker, firefox_worker)):
                raise ValueError('parallel sandbox differs from release under test')
            serial = {'performance-budgets', 'journey-perf-lab', 'data-large-backup',
                      'capacity-beyond-string', 'capacity-browser', 'capacity-rows', 'capacity-bytes', 'clean-build-twice'}
            # Document generation and reopening share fixtures in the primary checkout.
            # These browser suites own their HTTP fixture and do not consume that output.
            desktop = {'e2e-browser', 'ux-extended-browser', 'v12-browser-chromium', 'v12-keyboard',
                       'v12-print-contrast', 'v12-roles-reflow', 'browser-v13-chromium', 'journey-browser-chromium',
                       'intent-browser-chromium', 'offline-capability-chromium', 'map-native-zoom', 'catalog-offline-v151-chromium',
                       'enter-cycles-chromium', 'next-viewport-chromium'}
            firefox = {'browser-v13-firefox', 'journey-browser-firefox', 'intent-browser-firefox',
                       'offline-capability-firefox', 'catalog-offline-v151-firefox', 'enter-cycles-firefox',
                       'next-viewport-firefox', 'offline-legacy-repeat-firefox'}
            with ThreadPoolExecutor(max_workers=2) as pool:
                parallel = pool.submit(run_group, [s for s in suites if s['id'] in desktop], worker)
                firefox_result = pool.submit(run_group, [s for s in suites if s['id'] in firefox], firefox_worker)
                results = run_group([s for s in suites if s['id'] not in serial | desktop | firefox], work)
                results.extend(firefox_result.result())
                results.extend(parallel.result())
            results.extend(run_group([s for s in suites if s['id'] in serial], work))
            by_id = {r['id']: r for r in results}
            results = [by_id[s['id']] for s in suites]
        else:
            results = run_group(suites, work)
        if any(qa_core.identity(checkout) != ident for checkout in (work, worker, firefox_worker) if checkout):
            raise ValueError('a suite modified the tested distribution')
        binding = qa_core.write_binding(staging, registry, results, ident, rt, registry_sha, diagnostic=diagnostic, policy=qa_core.policy_identity(ROOT))
        if not diagnostic:
            shutil.rmtree(out, ignore_errors=True); out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(staging, out)
        else:
            shutil.copytree(staging, out, dirs_exist_ok=True)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
        for label, checkout in [('primary', work), ('chromium', worker), ('firefox', firefox_worker)]:
            if checkout:
                if a.keep:
                    print(f'{label} sandbox kept at', checkout)
                else:
                    shutil.rmtree(checkout, ignore_errors=True)
    print(f"\nQA gate {binding['status']} · {len(results)} suites · {binding['assertions']} assertions · {out}")
    if diagnostic:
        print('diagnostic subset: no release binding was written')
        return 0 if binding['status'] == 'PASS' else 1
    problems = qa_core.verify_binding(ROOT, out, REGISTRY, rt=rt)
    if problems:
        print('binding re-verification failed:', *problems[:30], sep='\n  ')
        return 1
    print('binding re-verified from disk')
    return 0 if binding['status'] == 'PASS' else 3 if binding['status'] == 'BLOCKED_ENV' else 1


if __name__ == '__main__':
    raise SystemExit(main())
