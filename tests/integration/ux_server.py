"""Local-only test preview for the audit. Serve optional immutable 1.0.0 under /baseline/."""
import argparse
import json
import os
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from fixture_server import StaticHandler, ROOT

class Review(StaticHandler):
    def do_GET(self):
        if re.fullmatch(r'/probe-temporary-[a-f0-9-]{36}/school/math/',urlsplit(self.path).path):
            index=(ROOT/'dist/index.html').read_bytes()
            body=index.replace(b'<head>',b'<head><script src="/__qa/integration/temporary.js"></script>',1)
            self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
        return super().do_GET()
    def send_error(self, code, message=None, explain=None):
        if code!=404 or self.command not in ('GET','HEAD') or not urlsplit(self.path).path.startswith('/school/math/'):
            return super().send_error(code,message,explain)
        body=(ROOT/'dist/404.html').read_bytes()
        self.send_response(404);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers()
        if self.command!='HEAD':self.wfile.write(body)
    def translate_path(self, raw):
        path = unquote(urlsplit(raw).path)
        if path == '/' or path == '/index.html':
            return str(ROOT / 'tests/integration/ux.html')
        if self.server.guide and path == '/guide':
            return str(self.server.guide)
        if self.server.baseline and path.startswith('/baseline/'):
            base = self.server.baseline
            item = (base / path.removeprefix('/baseline/')).resolve()
            return str(item if item.is_relative_to(base) else base / '.missing')
        return super().translate_path(raw)
    def end_headers(self):
        if urlsplit(self.path).path=='/guide':return SimpleHTTPRequestHandler.end_headers(self)
        return super().end_headers()
    def guess_type(self,path):
        if self.server.guide and Path(path)==self.server.guide:
            return 'text/html'
        return super().guess_type(path)
    def do_POST(self):
        if self.path != '/__qa/ux-receipt':return super().do_POST()
        try:
            if urlsplit(self.headers.get('Origin','')).netloc!=self.headers.get('Host'):raise ValueError('origin')
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<10_000_000:raise ValueError('length')
            data=json.loads(self.rfile.read(length))
            if data['suite'] not in ('baseline-ux','guide','player-ux','school-ux','visual-ux','shell-ux','reflow-ux','perf-ux','data-ux'):raise ValueError('name')
            dest=ROOT/'evidence/ux/acceptance'/('browser-'+data['suite']+'.json')
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        except (ValueError,KeyError,OSError):return self.send_error(400)
        self.send_response(204);self.end_headers()

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--host',nargs='?',const='0.0.0.0',default='127.0.0.1')
    p.add_argument('--port',type=int,default=int(os.environ.get('PORT','5173')))
    p.add_argument('--strictPort',action='store_true')
    p.add_argument('--baseline',type=Path)
    p.add_argument('--guide',type=Path)
    a=p.parse_args(); srv=ThreadingHTTPServer((a.host,a.port),Review)
    srv.baseline=a.baseline and a.baseline.resolve();srv.guide=a.guide and a.guide.resolve();srv.serve_forever()
