"""HTTP smoke/preview server for built static files; optional TLS and subpath."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import ssl
from urllib.parse import urlsplit, unquote
from fnmatch import fnmatchcase

DIST = Path(__file__).resolve().parents[1] / "dist"


def header_rules(directory):
    rules = []
    for line in (directory / "_headers").read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        if not line.startswith((" ", "\t")):
            rules.append((line.strip(), []))
        else:
            rules[-1][1].append(line.strip())
    return rules


def make_handler(directory, prefix):
    rules = header_rules(directory)
    class Static(SimpleHTTPRequestHandler):
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript",
                          ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json"}
        def send_error(self, code, message=None, explain=None):
            page = directory / "404.html"
            if code != 404 or not page.is_file():
                return super().send_error(code, message, explain)
            body = page.read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def send_head(self):
            rel = unquote(urlsplit(self.path).path)
            if not rel.startswith(prefix) or rel.endswith(("/_headers", "/_redirects")):
                self.send_error(404)
                return
            return super().send_head()

        def translate_path(self, path):
            actual = urlsplit(path).path
            if not actual.startswith(prefix):
                return str(directory / ".invalid-request")
            return super().translate_path("/" + actual[len(prefix):])

        def list_directory(self, path):
            self.send_error(404)
            return None

        def end_headers(self):
            url = "/" + urlsplit(self.path).path[len(prefix):]
            headers = {}
            for pattern, values in rules:
                if fnmatchcase(url, pattern):
                    for setting in values:
                        if setting.startswith("! "):
                            headers.pop(setting[2:].lower(), None)
                        else:
                            key, value = setting.split(":", 1)
                            headers[key.lower()] = (key, value.strip())
            for name, value in headers.values():
                self.send_header(name, value)
            super().end_headers()
    return partial(Static, directory=str(directory))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", default=4173, type=int)
    ap.add_argument("--bind", default="127.0.0.1")
    ap.add_argument("--prefix", default="/")
    ap.add_argument("--cert")
    ap.add_argument("--key")
    args = ap.parse_args()
    prefix = "/" + args.prefix.strip("/") + "/" if args.prefix.strip("/") else "/"
    with ThreadingHTTPServer((args.bind, args.port), make_handler(DIST, prefix)) as httpd:
        if args.cert:
            tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            tls.load_cert_chain(args.cert, args.key)
            httpd.socket = tls.wrap_socket(httpd.socket, server_side=True)
        protocol = "https" if args.cert else "http"
        print(f"{protocol}://{args.bind}:{httpd.server_port}{prefix}", flush=True)
        httpd.serve_forever()


if __name__ == "__main__":
    main()
