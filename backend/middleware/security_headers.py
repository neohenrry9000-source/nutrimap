"""Encabezados HTTP de seguridad — OWASP Secure Headers."""
from flask import request, jsonify

def register_security_headers(app):
    @app.before_request
    def _csrf_check():
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            origin = request.headers.get("Origin")
            if origin:
                allowed = app.config.get("CORS_ORIGINS", [])
                if allowed and not any(origin.startswith(o) for o in allowed):
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
        # CSP: la API solo devuelve JSON, así que prohibimos todo lo
        # demás. El frontend tiene su propia CSP servida por Nginx/Render.
        resp.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        )
        # HSTS: solo cuando se sirve por HTTPS (Render lo hace)
        if app.config.get("FLASK_ENV") == "production":
            resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return resp
