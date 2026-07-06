"""Encabezados HTTP de seguridad — OWASP Secure Headers."""
from flask import request, jsonify

def register_security_headers(app):
    @app.before_request
    def _csrf_check():
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            origin = request.headers.get("Origin")
            if origin:
                allowed = [o.strip().rstrip("/") for o in app.config.get("CORS_ORIGINS", [])]
                # Comparación exacta: startswith permitiría
                # https://dominio-permitido.com.evil.com
                if allowed and origin.rstrip("/") not in allowed:
                    return jsonify(error="forbidden"), 403

    @app.after_request
    def _headers(resp):
        # Bloquea framing (clickjacking)
        resp.headers["X-Frame-Options"] = "DENY"
        # Evita sniff de MIME (XSS via tipos colgados)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        # No filtres referrer
        resp.headers["Referrer-Policy"] = "no-referrer"
        # Política mínima de permisos del navegador
        resp.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=(), payment=()"
        # Payment: El navegador también tiene bloqueado el acceso a la API de pagos del navegador (Apple Pay/Google Pay)
        # HSTS: solo cuando se sirve por HTTPS (Render lo hace)
        if app.config.get("SECURE_COOKIES"):
            resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        resp.headers["Cache-Control"] = "no-store"
        return resp
