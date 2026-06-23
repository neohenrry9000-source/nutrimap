"""Encabezados HTTP de seguridad — OWASP Secure Headers."""

def register_security_headers(app):
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
        if app.config.get("FLASK_ENV") == "production":
            resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return resp
