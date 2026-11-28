"""Exercise the shipped tree over HTTP and certificate-verified local TLS."""
import hashlib
import json
import re
import ssl
import subprocess
import tempfile
import threading
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urljoin
from urllib.request import urlopen, Request
from http.server import ThreadingHTTPServer
from preview import make_handler, DIST

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths=[]
    def handle_starttag(self,tag,attrs):
        data=dict(attrs)
        if tag=='script' and 'src' in data:self.paths.append(data['src'])
        if tag=='link' and 'href' in data:self.paths.append(data['href'])

def exercise(protocol,prefix,keys):
    ctx=None
    server=ThreadingHTTPServer(('127.0.0.1',0),make_handler(DIST,prefix))
    if protocol=='https':
        serverctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        serverctx.load_cert_chain(keys/'cert.pem',keys/'key.pem')
        server.socket=serverctx.wrap_socket(server.socket,server_side=True)
        ctx=ssl.create_default_context(cafile=str(keys/'cert.pem'))
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    url=f'{protocol}://127.0.0.1:{server.server_port}'+prefix
    records=[]
    def request(route,kind=None):
        with urlopen(urljoin(url,route),context=ctx,timeout=8) as r:
            body=r.read()
            mime=r.headers.get_content_type()
            assert r.status==200
            if kind: assert mime in kind,(route,mime)
            assert r.headers.get('X-Content-Type-Options')=='nosniff'
            assert "script-src 'self'" in r.headers['Content-Security-Policy']
            assert 'unsafe-eval' not in r.headers['Content-Security-Policy']
            assert r.headers['Cache-Control']
            records.append(dict(path=route,status=r.status,mime=mime,bytes=len(body),
                                cache=r.headers['Cache-Control'],sha256=hashlib.sha256(body).hexdigest()))
            return body
    try:
        parser=Assets()
        parser.feed(request('',{'text/html'}).decode())
        for asset in parser.paths:
            request(asset)
        request('sw.js',{'text/javascript','application/javascript'})
        manifest=json.loads(request('bank/index.json',{'application/json'}))
        offline=json.loads(request('offline-assets.json',{'application/json'}))
        for i in (0,-1):
            grade=json.loads(request(manifest['grades'][i]['url'],{'application/json'}))
            level=json.loads(request(grade['levels'][i]['url'],{'application/json'}))
            pack=next(e for e in level['competencies'] if e['active'])['packages'][i]
            buf=request(pack['url'],{'text/javascript','application/javascript'})
            assert hashlib.sha256(buf).hexdigest()==pack['sha256']
            assert 'immutable' in records[-1]['cache']
        for asset in offline['assets']:
            assert hashlib.sha256((DIST/asset['path']).read_bytes()).hexdigest()==asset['sha256']
        error_page = (DIST / '404.html').read_bytes()
        script = error_page.split(b'<script>',1)[1].split(b'</script>',1)[0]
        import base64
        allowed_hash = "'sha256-"+base64.b64encode(hashlib.sha256(script).digest()).decode()+"'"
        for missing in ['missing/deep/path', 'missing.json', '_headers']:
            for method in ('GET', 'HEAD'):
                req = Request(urljoin(url,missing),method=method)
                try:
                    urlopen(req,context=ctx,timeout=8)
                except HTTPError as e:
                    assert e.code == 404
                    assert e.headers.get_content_type() == 'text/html'
                    assert allowed_hash in e.headers['Content-Security-Policy']
                    assert e.read() == (error_page if method=='GET' else b'')
                    records.append(dict(path=missing,method=method,status=404,body='branded-404' if method=='GET' else 'empty-head'))
                else:
                    raise ValueError('expected HTTP 404 for '+missing)
    finally:
        server.shutdown();server.server_close();thread.join()
    return dict(protocol=protocol,prefix=prefix,responses=records,verified_offline_assets=len(offline['assets']))

def main():
    with tempfile.TemporaryDirectory() as tmp:
        keys=Path(tmp)
        subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(keys/'key.pem'),
                        '-out',str(keys/'cert.pem'),'-days','1','-subj','/CN=localhost',
                        '-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],capture_output=True,check=True)
        cases=[exercise(proto,pre,keys) for proto in ('http','https') for pre in ('/','/sekolah/matematika/')]
    evidence={'status':'PASS','scope':'Local network fixture with configured Pages headers; public hosting untested',
              'cases':cases,'certificate_check':'Verified against one-run local self-signed trust anchor; no private key retained'}
    target=DIST.parent/'evidence/deployment/static-http-https.json'
    target.write_text(json.dumps(evidence,indent=2)+'\n')
    print('PASS',len(cases),'HTTP/TLS and base-path combinations.')
if __name__=='__main__':main()
