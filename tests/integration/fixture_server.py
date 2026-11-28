"""Static preview for release tests, with Pages-style headers and a nested installation.

The test index and test assets are served outside dist/. No collector is shipped with the app.
"""
import argparse
from contextlib import contextmanager
from fnmatch import fnmatch
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Event, Lock, Thread
from urllib.parse import unquote, urlsplit
import os
import json
import hashlib
import re
import time

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'dist'
PREFIX = '/school/math/'


def headers_for(path):
    config = DIST / '_headers'
    if not config.exists():
        return {}
    result = {}
    matches = False
    for line in config.read_text().splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        if line.startswith('/'):
            matches = fnmatch(path, line.strip())
        elif matches and ':' in line:
            name, val = line.strip().split(':', 1)
            result[name] = val.strip()
    return result


class StaticHandler(SimpleHTTPRequestHandler):
    extensions_map = dict(SimpleHTTPRequestHandler.extensions_map, **{
        '.mjs': 'text/javascript', '.js':'text/javascript', '.webmanifest':'application/manifest+json',
        '.json':'application/json','.woff2':'font/woff2',
    })
    failed_paths = set()
    fault_lock = Lock()
    probe_states = {}

    def probe_response(self, token, suffix):
        state = self.probe_states.get(token, 'original')
        if state == 'outage':
            self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, 'Isolated QA outage')
            return True
        if state != 'updated' or suffix not in ('app.mjs', 'offline-assets.json', 'sw.js'):
            return False
        manifest = json.loads((DIST / 'offline-assets.json').read_text())
        bundle = (DIST / 'app.mjs').read_bytes() + b'\n// Isolated offline upgrade test revision B.\n'
        meta = next(a for a in manifest['assets'] if a['path']=='app.mjs')
        meta.update(bytes=len(bundle), sha256=hashlib.sha256(bundle).hexdigest())
        new = hashlib.sha256(json.dumps(manifest['assets'], separators=(',',':'), ensure_ascii=False).encode()).hexdigest()[:16]
        old = manifest['release']
        manifest['release'] = new
        body = bundle if suffix=='app.mjs' else (
            (json.dumps(manifest,separators=(',',':'),ensure_ascii=False)+'\n').encode() if suffix=='offline-assets.json'
            else (DIST / 'sw.js').read_bytes().replace(old.encode(), new.encode()))
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-Type','application/json' if suffix.endswith('.json') else 'text/javascript')
        self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store')
        self.end_headers()
        self.wfile.write(body)
        return True

    def do_GET(self):
        raw = urlsplit(self.path).path
        if re.fullmatch(r'/probe-slowmath-[a-f0-9-]{36}/school/math/math/typeset[.]mjs',raw):time.sleep(1.5)
        renderer = re.fullmatch(r'/probe-renderer-([a-f0-9-]{36})/school/math/math/typeset[.]mjs',raw)
        if renderer:
            with self.fault_lock:
                token='renderer-'+renderer.group(1)
                if token not in self.failed_paths:
                    self.failed_paths.add(token)
                    self.send_error(503,'One-time renderer fault')
                    return
        match = re.fullmatch(r'/probe-offline-([a-f0-9-]{36})/school/math/(.*)',raw)
        if match and self.probe_response(match.group(1),match.group(2)):
            return
        if '/probe-fault-' in raw and raw.endswith('/bank/index.json'):
            with self.fault_lock:
                first = raw not in self.failed_paths
                self.failed_paths.add(raw)
            if first:
                self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, 'Synthetic first-request outage')
                return
        if '/probe-slow-' in raw and '/bank/' in raw and raw.endswith('.json'):
            time.sleep(0.6)
        super().do_GET()

    def log_message(self, fmt, *args):
        pass

    def translate_path(self, raw):
        path = unquote(urlsplit(raw).path)
        path = re.sub(r'^/probe-[a-z0-9-]+(?=/school/math/)', '', path)
        if path.startswith('/__qa/'):
            base, rest = ROOT / 'tests', path.removeprefix('/__qa/')
        else:
            base, rest = DIST, path.removeprefix(PREFIX).lstrip('/')
        target = (base / rest).resolve()
        if not target.is_relative_to(base):
            return str(base / '.unavailable')
        return str(target)

    def end_headers(self):
        raw_path = re.sub(r'^/probe-[a-z0-9-]+(?=/school/math/)', '', urlsplit(self.path).path)
        if not raw_path.startswith('/__qa/'):
            path = '/' + raw_path.removeprefix(PREFIX).lstrip('/')
            for name, value in headers_for(path).items():
                self.send_header(name, value)
        super().end_headers()

    def do_POST(self):
        if self.path == '/__qa/availability':
            if urlsplit(self.headers.get('Origin','')).netloc != self.headers.get('Host'):
                self.send_error(HTTPStatus.FORBIDDEN)
                return
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0<length<2048:raise ValueError()
                data=json.loads(self.rfile.read(length))
                token=data['token']
                state=data['state']
                if not re.fullmatch(r'[a-f0-9-]{36}',token) or state not in ('original','updated','outage'):raise ValueError()
                self.probe_states[token]=state
            except (KeyError,TypeError,ValueError):
                self.send_error(HTTPStatus.BAD_REQUEST)
                return
            self.send_response(HTTPStatus.NO_CONTENT)
            self.end_headers()
            return
        # A test-only same-origin result sink. This class never ships in dist/.
        if self.path != '/__qa/receipts' or urlsplit(self.headers.get('Origin','')).netloc != self.headers.get('Host'):
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        try:
            length = int(self.headers.get('Content-Length','0'))
            if length <= 0 or length > 4_000_000:
                raise ValueError()
            data = json.loads(self.rfile.read(length))
            name = data["suite"]
            if name not in ('journeys','layout','performance','data','semantics','faults','teacher','offline'):
                raise ValueError()
            engine=os.environ.get('KALIBATAKU_QA_ENGINE')
            folder=ROOT/'evidence'/'v12'/'cross'/engine if engine in ('firefox','webkit') else ROOT/'evidence'/'acceptance'
            dest=folder / ('browser-' + name + '.json')
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        except (KeyError, OSError, ValueError, TypeError):
            self.send_error(HTTPStatus.BAD_REQUEST)
            return
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND)
        return None


@contextmanager
def fixture_server(port=0, host='127.0.0.1'):
    server = ThreadingHTTPServer((host, port), StaticHandler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}'
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT','5173')))
    parser.add_argument('--host', nargs='?', const='0.0.0.0', default='127.0.0.1')
    parser.add_argument('--strictPort', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    with fixture_server(args.port,args.host) as url:
        print(f'Static QA fixture at {url}',flush=True)
        Event().wait()
