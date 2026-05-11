from flask import Flask, jsonify
from src.extensions import db, migrate, jwt
from src.business.analytics import get_anemia_stats
from src.customer.routes import customer_bp
import os

def create_app():
    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"]    = os.environ.get("DATABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"]             = os.environ.get("JWT_SECRET_KEY", "dev-secret")

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    app.register_blueprint(customer_bp)

    @app.route("/")
    def home():
        return "NutriMap Activo", 200

    @app.route("/api/v1/anemia/stats")
    def anemia_stats():
        stats = get_anemia_stats()
        return jsonify(stats), 200

    @app.route("/health")
    def health():
        return jsonify({"status": "healthy"}), 200

    return app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)