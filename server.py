#!/usr/bin/env python3
"""
VozSegura — Servidor HTTPS local para pruebas PWA.

Las PWA REQUIEREN HTTPS (o localhost) para funcionar.
Este script levanta un servidor con certificado auto-firmado.

Uso:
  python3 server.py

Luego abre en tu celular (misma red WiFi):
  https://192.168.X.X:8443

Acepta la advertencia de certificado y listo.
"""

import http.server
import ssl
import os
import subprocess
import socket

PORT = 8443
CERT_FILE = "cert.pem"
KEY_FILE  = "key.pem"

def get_local_ip():
    """Obtiene la IP local de esta computadora en la red WiFi."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except:
        return "127.0.0.1"
    finally:
        s.close()

def generar_certificado():
    """Genera certificado SSL auto-firmado si no existe."""
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        return
    print("Generando certificado SSL auto-firmado...")
    subprocess.run([
        "openssl", "req", "-x509", "-newkey", "rsa:2048",
        "-keyout", KEY_FILE, "-out", CERT_FILE,
        "-days", "365", "-nodes", "-subj",
        "/C=MX/ST=Jalisco/L=PuertoVallarta/O=VozSegura/CN=localhost"
    ], check=True, capture_output=True)
    print(f"  ✓ Certificado generado: {CERT_FILE}")

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """Handler que agrega headers de no-cache para desarrollo."""
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Service-Worker-Allowed", "/")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()

    def log_message(self, format, *args):
        print(f"  [{self.address_string()}] {format % args}")

def main():
    generar_certificado()
    ip = get_local_ip()

    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(CERT_FILE, KEY_FILE)

    server = http.server.HTTPServer(("0.0.0.0", PORT), NoCacheHandler)
    server.socket = context.wrap_socket(server.socket, server_side=True)

    print(f"""
╔══════════════════════════════════════════════════╗
║   VozSegura PWA — Servidor de pruebas activo     ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  En esta computadora:                            ║
║  → https://localhost:{PORT}                       ║
║                                                  ║
║  En tu celular (misma red WiFi):                 ║
║  → https://{ip}:{PORT}                 ║
║                                                  ║
║  ⚠  Acepta el aviso de certificado en el         ║
║     celular — es normal para desarrollo          ║
║                                                  ║
║  Para instalar la PWA en Android:                ║
║  Chrome → menú ⋮ → "Añadir a pantalla inicio"  ║
║                                                  ║
║  Ctrl+C para detener                             ║
╚══════════════════════════════════════════════════╝
""")
    server.serve_forever()

if __name__ == "__main__":
    main()
