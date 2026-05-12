"""HTTP-to-SOCKS5 proxy for git push"""
import socks, socket
socks.set_default_proxy(socks.SOCKS5, '127.0.0.1', 10808)
socket.socket = socks.socksocket

from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request, select, threading

class Handler(BaseHTTPRequestHandler):
    def do_CONNECT(self):
        host, port = self.path.split(':')
        try:
            self.send_response(200, 'OK')
            self.end_headers()
            self.wfile.flush()
        except: return
        try:
            remote = socket.create_connection((host, int(port)), timeout=30)
            def relay(a, b):
                try:
                    while True:
                        d = a.recv(8192)
                        if not d: break
                        b.sendall(d)
                except: pass
            t1 = threading.Thread(target=relay, args=(self.connection, remote), daemon=True)
            t2 = threading.Thread(target=relay, args=(remote, self.connection), daemon=True)
            t1.start(); t2.start()
            t1.join(timeout=120); t2.join(timeout=120)
            remote.close()
        except: pass

    def do_GET(self):  self._proxy()
    def do_POST(self): self._proxy()
    def _proxy(self):
        try:
            body = None
            cl = int(self.headers.get('Content-Length', 0))
            if cl > 0: body = self.rfile.read(cl)
            req = urllib.request.Request(self.path, data=body, method=self.command)
            for k, v in self.headers.items():
                if k.lower() not in ('host','proxy-connection','proxy-authorization'):
                    req.add_header(k, v)
            resp = urllib.request.urlopen(req, timeout=30)
            self.send_response(resp.status)
            for k, v in resp.headers.items():
                if k.lower() != 'transfer-encoding':
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(resp.read())
        except Exception as e:
            self.send_error(502, str(e))

    def log_message(self, *a): pass

if __name__ == '__main__':
    srv = HTTPServer(('127.0.0.1', 18888), Handler)
    print('Bridge: 127.0.0.1:18888 -> SOCKS5:10808')
    srv.serve_forever()
