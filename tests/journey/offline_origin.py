"""Loopback-only test origin. Disconnection closes accepted sockets without replying."""
from http.server import ThreadingHTTPServer
from pathlib import Path
import sys
import threading

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools"))
from preview import make_handler


class TestOrigin(ThreadingHTTPServer):
    def __init__(self, site):
        handler = make_handler(site, "/")
        handler.func.log_message = lambda *unused: None
        super().__init__(("127.0.0.1", 0), handler)
        self.disconnected = False
        self.url = f"http://127.0.0.1:{self.server_port}/"
        self.thread = threading.Thread(target=self.serve_forever, daemon=True)
        self.thread.start()

    def verify_request(self, request, client_address):
        return not self.disconnected

    def network(self, enabled, context, engine):
        # WebKit's protocol-level offline switch also blocks service-worker
        # navigation. Disconnect the origin itself so the real worker handles
        # reload, local cache lookups and IndexedDB while network I/O fails.
        self.disconnected = not enabled
        if engine != "webkit":
            context.set_offline(not enabled)

    def close(self):
        self.shutdown()
        self.server_close()
        self.thread.join()
