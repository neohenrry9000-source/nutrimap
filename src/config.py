import os
from datetime import timedelta

class BaseConfig:
    SECRET_KEY     = os.environ["FLASK_SECRET_KEY"]
    JSON_SORT_KEYS = False
    JWT_SECRET     = os.environ["JWT_SECRET"]
    JWT_ALG        = "HS256"
    JWT_EXP        = timedelta(hours=2)
    CORS_ORIGINS   = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    SUPABASE_URL          = os.environ["SUPABASE_URL"]
    SUPABASE_ANON_KEY     = os.environ["SUPABASE_ANON_KEY"]
    SUPABASE_SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY")
    RATELIMIT_DEFAULT     = "200 per hour"
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

class DevConfig(BaseConfig):
    DEBUG   = True
    TESTING = False

class ProdConfig(BaseConfig):
    DEBUG   = False
    TESTING = False

def get_config():
    return ProdConfig if os.environ.get("FLASK_ENV") == "production" else DevConfig