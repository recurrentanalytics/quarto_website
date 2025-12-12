import http.server
import socketserver
import os

PORT = 5000
DIRECTORY = "_site"

os.chdir(DIRECTORY)

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

class ReuseAddrTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

with ReuseAddrTCPServer(("0.0.0.0", PORT), NoCacheHandler) as httpd:
    print(f"Serving {DIRECTORY} at http://0.0.0.0:{PORT}")
    httpd.serve_forever()
