"""Serve the teacher test console on loopback; run against the packaged dist/."""
from pathlib import Path
from http.server import ThreadingHTTPServer
import json,sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests/integration'))
from fixture_server import StaticHandler
class Handler(StaticHandler):
    def do_POST(self):
        if self.path!='/__qa/teacher-result':
            self.send_error(404);return
        try:
            n=int(self.headers['Content-Length']);assert 0<n<100000
            assert self.headers['Origin']=='http://'+self.headers['Host']
            data=json.loads(self.rfile.read(n))
            assert data['status'] in ('PASS','FAIL')
            (ROOT/'evidence/teacher/browser.json').write_text(json.dumps(data,indent=2))
        except Exception:
            self.send_error(400);return
        self.send_response(204);self.end_headers()
if __name__=='__main__':
    port=int(sys.argv[1]) if len(sys.argv)>1 else 4174
    print('Teacher test console http://127.0.0.1:'+str(port)+'/__qa/teacher/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
