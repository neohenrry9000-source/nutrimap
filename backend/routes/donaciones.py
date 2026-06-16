"""
/api/donar — flujo de pago DEMO.

IMPORTANTE para el informe:
  * Esto NO procesa pagos reales.
  * NUNCA persistimos el PAN ni el CVV (cumplimiento PCI-DSS).
  * Solo guardamos un identificador derivado (`referencia_pago`) que es
    el SHA-256 truncado de un nonce + últimos 4 dígitos. Permite trazar la 
    donación sin almacenar datos sensibles.
"""
import hashlib
import secrets
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from pydantic import ValidationError

from services.security        import require_role
from services.supabase_client import client_service
from validators.schemas       import DonarIn

bp_don = Blueprint("don", __name__)


@bp_don.post("/donar")
@require_role("donador", "admin")
def donar():
    try:
        data = DonarIn(**(request.get_json(silent=True) or {}))
    except ValidationError as e:
        return jsonify(error="validation", detail=e.errors()), 400

    # tokenizar: nunca tocamos card_number/cvv después de esta línea
    nonce = secrets.token_hex(8)
    last4 = data.card_number[-4:]
    ref = hashlib.sha256(f"{nonce}|{last4}".encode()).hexdigest()[:40]

    sb = client_service()
    ins = sb.table("donaciones").insert({
        "id_donante":      g.user["sub"],
        "id_organizacion": data.id_organizacion,
        "monto":           data.monto,
        "moneda":          data.moneda,
        "estado":          "pendiente",
        "referencia_pago": ref,
        "fecha":           datetime.now(timezone.utc).isoformat(),
    }).execute()

    return jsonify(ok=True,
                   referencia=ref,
                   donacion=ins.data[0] if ins.data else None)
