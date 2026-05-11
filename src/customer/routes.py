from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from src.extensions import db
from src.customer.models import User, Profile
from src.security.encryption import hash_password, verify_password

customer_bp = Blueprint("customer", __name__, url_prefix="/api/v1/auth")

@customer_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email ya registrado"}), 409

    user = User(
        email    = data["email"],
        password = hash_password(data["password"]),
        nombre   = data["nombre"],
        apellido = data["apellido"]
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Usuario creado", "id": user.id}), 201

@customer_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data["email"]).first()

    if not user or not verify_password(data["password"], user.password):
        return jsonify({"error": "Credenciales inválidas"}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({"access_token": token}), 200

@customer_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user    = User.query.get(user_id)

    return jsonify({
        "id":       user.id,
        "email":    user.email,
        "nombre":   user.nombre,
        "apellido": user.apellido,
        "role":     user.role,
        "profile":  {
            "edad":   user.profile.edad   if user.profile else None,
            "region": user.profile.region if user.profile else None,
        }
    }), 200

@customer_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user    = User.query.get(user_id)
    data    = request.get_json()

    if not user.profile:
        user.profile = Profile(user_id=user.id)

    user.profile.edad   = data.get("edad",   user.profile.edad)
    user.profile.region = data.get("region", user.profile.region)
    db.session.commit()

    return jsonify({"message": "Perfil actualizado"}), 200