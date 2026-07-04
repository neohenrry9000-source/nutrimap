"""Configuración por entorno. Lee de variables de entorno; nunca hardcodear."""
import os
from datetime import timedelta


class BaseConfig:
    # Flask
    SECRET_KEY = os.environ["FLASK_SECRET_KEY"]    # falla rápido si falta
    JSON_SORT_KEYS = False

    # JWT (PyJWT)
    JWT_SECRET     = os.environ["JWT_SECRET"]
    JWT_ALG        = "HS256"
    JWT_EXP        = timedelta(hours=2)

    # CORS
    CORS_ORIGINS   = os.environ.get("CORS_ORIGINS", "https://nutrimap-prod-frontend.onrender.com").split(",")

    # Supabase
    SUPABASE_URL          = os.environ["SUPABASE_URL"]
    SUPABASE_ANON_KEY     = os.environ["SUPABASE_ANON_KEY"]
    SUPABASE_SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY")  # solo server-side

    # Rate limiting (Flask-Limiter)
    RATELIMIT_DEFAULT     = "200 per hour"
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    # Yape (datos de cobro que se muestran al donante; no son secretos)
    YAPE_NUMERO  = os.environ.get("YAPE_NUMERO", "987 654 321")
    YAPE_TITULAR = os.environ.get("YAPE_TITULAR", "NutriMap Solidario")


class DevConfig(BaseConfig):
    DEBUG  = True
    TESTING = False


class ProdConfig(BaseConfig):
    DEBUG  = False
    TESTING = False


def get_config():
    return ProdConfig if os.environ.get("FLASK_ENV") == "production" else DevConfig
