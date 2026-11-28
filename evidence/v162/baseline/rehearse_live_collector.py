"""Exercise the optional deployment collector with an inert loopback target and synthetic validation fixtures."""
import argparse
from copy import deepcopy
from datetime import timedelta
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))
import live_gate


def browser_fixture():
    spec = importlib.util.spec_from_file_location('browser_rollout', ROOT / 'tests/v15/update-rollback-local.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    class Origin(module.ReleaseServer):
        restore_candidate = True

        def __init__(self, directory):
            super().__init__(directory)
            self.witnesses = []
            self.stages = [{'phase':'candidate'}]

        def verify_request(self, request, address):
            # The origin remains reachable even when the browser goes offline.
            return True

        def offline_witness(self, context, page):
            live_gate.PublicRollout.offline_witness(self, context, page)
            self.stages = [{'phase':'rollback'}]

    with live_gate.old_distribution() as (old, _), tempfile.TemporaryDirectory() as out:
        origin = Origin(old)
        browser = module.exercise(old, ROOT / 'dist', Path(out), origin)
        return origin.base, browser, origin.witnesses


def inert_http_stage(phase, timestamp, url):
    release, assets, csp, package = live_gate.expected(ROOT, phase in ('baseline','rollback'))
    absent = '__kalibataku_missing_' + uuid4().hex
    responses = []
    for name in sorted(set(assets) - {'404.html'} | {absent}):
        path = '404.html' if name == absent else name
        checksum, size = assets[path]
        immutable = name == package
        responses.append({'requested':name, 'path':name, 'status':404 if name == absent else 200,
                          'sha256':checksum, 'bytes':size, 'mime':live_gate.MIMALLOWED[Path(path).suffix][0],
                          'nosniff':'nosniff', 'cache':('public, max-age=31536000, immutable' if immutable
                                                        else 'public, max-age=0, must-revalidate'), 'csp':csp,
                          'tls':{'peer':'8.8.8.8', 'version':'TLSv1.3', 'certificate_sha256':'a'*64}})
    return {'phase':phase,'url':url,'release':release,'started':timestamp.isoformat(),
            'finished':timestamp.isoformat(),'absent':absent,'responses':responses}


def validation_fixtures(browser, witnesses, build):
    # All public-domain, TLS, MIME and HTTP fields in this in-memory fixture are fabricated test inputs.
    # No request to this domain is made. Never write the synthetic receipt to a canonical location.
    url = 'https://fixture.example.org/'
    browser = deepcopy(browser)
    browser['url'] = url
    start, end = live_gate.date(browser['started']), live_gate.date(browser['completed'])
    mid = start + (end-start)/2
    phases = [start-timedelta(seconds=1), mid, mid+timedelta(milliseconds=1), mid+timedelta(milliseconds=2)]
    stages = [inert_http_stage(p, t, url) for p,t in zip(live_gate.PHASES, phases, strict=True)]
    samples = [dict(w, url=url+w['url'].split('/')[-1], worker=url+'sw.js') for w in witnesses]
    receipt = {'schema':'kalibataku-public-rollout/1','target_url':url,'status':'PASS','build':build,
               'stages':stages,'started':(start-timedelta(seconds=2)).isoformat(),'finished':end.isoformat(),
               'offline_witnesses':samples,'browser':browser}
    live_gate.validate(ROOT,build,receipt)
    mutations = {
        'missing-restore-stage': lambda d:d['stages'].pop(),
        'wrong-asset-hash':lambda d:d['stages'][1]['responses'][0].update(sha256='a'*64),
        'wrong-mime':lambda d:d['stages'][0]['responses'][0].update(mime='text/plain'),
        'missing-csp':lambda d:d['stages'][2]['responses'][0].update(csp=''),
        'missing-offline-probe':lambda d:d['offline_witnesses'].pop(),
        'missing-draft':lambda d:d['browser']['observations'][0].update(draft=''),
        'changed-restored-data':lambda d:d['browser']['observations'][-1].update(after='b'*64),
        'duplicate-completion':lambda d:d['browser']['observations'][-1].update(completion_events=2),
    }
    rejections = {}
    for label, mutate in mutations.items():
        changed = deepcopy(receipt)
        mutate(changed)
        try:
            live_gate.validate(ROOT, build, changed)
        except ValueError as exc:
            rejections[label] = str(exc)
        else:
            raise ValueError(f'Invalid diagnostic fixture was accepted: {label}')
    return rejections


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    build = live_gate.qa_core.identity(ROOT)
    url, browser, probes = browser_fixture()
    negative = validation_fixtures(browser, probes, build)
    report = {'scope':'Loopback/inert diagnostic only. No public target, real TLS or deployment was exercised.',
              'build':build, 'tested_utc':live_gate.stamp(), 'loopback_url':url, 'engine':browser['engine'],
              'observations':browser['observations'], 'local_offline_probes':probes,'synthetic_rejections':negative}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8', newline='\n')
    print('PASS local browser phases:',len(browser['observations']),'and rejected synthetic fixtures:',len(negative))
