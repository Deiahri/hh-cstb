"""Local server that never lets the browser cache. Run: python3 serve.py  (port 5197)"""
import http.server, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store, must-revalidate'); self.send_header('Expires','0')
        super().end_headers()
    def log_message(self,*a): pass
port=int(sys.argv[1]) if len(sys.argv)>1 else 5197
http.server.ThreadingHTTPServer(('',port),H).serve_forever()
