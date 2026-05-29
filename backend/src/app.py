from dotenv import load_dotenv
load_dotenv()

import logging
from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from config import get_config
from middleware.security_headers import register_security_headers
from routes.auth          import bp_auth
from routes.organizaciones import bp_org
from routes.donaciones    import bp_don
from routes.mapa          import bp_mapa

def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(get_config())

    CORS(app,
         origins=app.config["CORS_ORIGINS"],
         supports_credentials=False,
         allow_headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "OPTIONS"])

    limiter = Limiter(get_remote_address, app=app,
                      default_limits=[app.config["RATELIMIT_DEFAULT"]],
                      storage_uri=app.config["RATELIMIT_STORAGE_URI"])
    app.extensions["limiter"] = limiter

    register_security_headers(app)

    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")

    app.register_blueprint(bp_auth, url_prefix="/api")
    app.register_blueprint(bp_org,  url_prefix="/api")
    app.register_blueprint(bp_don,  url_prefix="/api")
    app.register_blueprint(bp_mapa, url_prefix="/api")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.errorhandler(400)
    def _400(e): return jsonify(error="bad_request"), 400
    @app.errorhandler(401)
    def _401(e): return jsonify(error="unauthorized"), 401
    @app.errorhandler(403)
    def _403(e): return jsonify(error="forbidden"), 403
    @app.errorhandler(404)
    def _404(e): return jsonify(error="not_found"), 404
    @app.errorhandler(429)
    def _429(e): return jsonify(error="too_many_requests"), 429
    @app.errorhandler(Exception)
    def _500(e):
        app.logger.exception("unhandled")
        return jsonify(error="internal_error"), 500

    return app

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000)  # nosec B104