from datetime import datetime
from src.extensions import db

class User(db.Model):
    __tablename__ = "users"

    id         = db.Column(db.Integer, primary_key=True)
    email      = db.Column(db.String(120), unique=True, nullable=False)
    password   = db.Column(db.String(255), nullable=False)
    nombre     = db.Column(db.String(80), nullable=False)
    apellido   = db.Column(db.String(80), nullable=False)
    role       = db.Column(db.String(20), default="user")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    profile = db.relationship("Profile", backref="user", uselist=False)

class Profile(db.Model):
    __tablename__ = "profiles"

    id                  = db.Column(db.Integer, primary_key=True)
    user_id             = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    edad                = db.Column(db.Integer)
    region              = db.Column(db.String(80))
    datos_nutricionales = db.Column(db.JSON)
    updated_at          = db.Column(db.DateTime, default=datetime.utcnow)