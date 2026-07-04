"""
Donaciones — flujo de pago DEMO con dos métodos:

  * tarjeta : pasarela demo que siempre aprueba -> estado 'completada'.
              NUNCA persistimos PAN/CVV (PCI-DSS); solo un identificador
              derivado (SHA-256 de nonce + últimos 4 dígitos).
  * yape    : se genera un código de operación y la donación queda
              'pendiente' hasta que el donante confirma el pago
              ("Ya pagué") -> estado 'confirmada'. En producción esto lo
              validaría un webhook o conciliación manual.

Anonimato: es_anonima oculta el nombre del donante en el feed público y
ante la organización; id_donante SIEMPRE queda registrado (auditoría) y
el donante ve su propio historial completo.
"""
import hashlib
import re
import secrets
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g, current_app
from pydantic import ValidationError

from services.security        import require_auth, require_role, require_cuenta_activa
from services.supabase_client import client_service, client_anon
from services.donaciones      import resumen_donaciones
from services.feed            import publicar_evento
from services.geo             import departamento_de
from services.niveles         import calcular_nivel
from validators.schemas       import DonarIn

bp_don = Blueprint("don", __name__)

_UUID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")


def _nombre_donante(sb, user_id, es_anonima):
    if es_anonima:
        return "Donante anónimo"
    row = (sb.table("usuarios").select("nombre")
             .eq("id", user_id).limit(1).execute())
    nombre = (row.data[0].get("nombre") or "").strip() if row.data else ""
    return nombre or "Un donante"


def _anunciar_donacion(sb, user_id, don: DonarIn, org):
    dep = departamento_de(org["ubigeo"])
    donante = _nombre_donante(sb, user_id, don.es_anonima)
    publicar_evento(
        sb, "donacion",
        titulo=f"Nueva donación en {dep}",
        mensaje=f"{donante} apoyó a {org['nombre']}",
        departamento=dep,
        monto=don.monto,
        moneda=don.moneda,
    )


@bp_don.post("/donar")
@require_role("donador", "admin")
@require_cuenta_activa
def donar():
    limiter = current_app.extensions["limiter"]
    limiter.limit("7/hour")(lambda: None)()
    try:
        data = DonarIn(**(request.get_json(silent=True) or {}))
    except ValidationError:
        return jsonify(error="validation", detail="Datos inválidos"), 400

    sb = client_service()
    org_row = (sb.table("organizaciones").select("*")
                 .eq("id", data.id_organizacion).eq("activa", True)
                 .limit(1).execute())
    if not org_row.data:
        return jsonify(error="organizacion_no_encontrada"), 404
    org = org_row.data[0]
    # Moderación: una org suspendida/baneada no recibe donaciones.
    if (org.get("estado") or "activo") != "activo":
        return jsonify(error="organizacion_no_disponible",
                       detail="Esta organización no puede recibir donaciones por ahora."), 409

    if data.metodo_pago == "yape":
        # Código de operación que el donante escribe en la app de Yape.
        ref = f"YP-{secrets.token_hex(4).upper()}"
        estado = "pendiente"
    else:
        # tokenizar: nunca tocamos card_number/cvv después de esta línea
        nonce = secrets.token_hex(8)
        last4 = data.card_number[-4:]
        ref = hashlib.sha256(f"{nonce}|{last4}".encode()).hexdigest()[:40]
        estado = "completada"

    payload = {
        "id_donante":      g.user["sub"],
        "id_organizacion": data.id_organizacion,
        "monto":           data.monto,
        "moneda":          data.moneda,
        "estado":          estado,
        "referencia_pago": ref,
        "fecha":           datetime.now(timezone.utc).isoformat(),
    }
    # Columnas nuevas solo cuando se usan: mantiene compatibilidad si la
    # BD aún no corrió sql/evolucion_producto.sql (el flujo clásico de
    # tarjeta no-anónima sigue funcionando igual).
    if data.metodo_pago != "tarjeta":
        payload["metodo_pago"] = data.metodo_pago
    if data.es_anonima:
        payload["es_anonima"] = True

    ins = sb.table("donaciones").insert(payload).execute()

    # El anuncio público sale cuando el dinero ingresa: tarjeta al toque,
    # Yape recién al confirmar.
    if estado == "completada":
        _anunciar_donacion(sb, g.user["sub"], data, org)

    resp = {
        "ok": True,
        "referencia": ref,
        "donacion": ins.data[0] if ins.data else None,
    }
    if data.metodo_pago == "yape":
        cfg = current_app.config
        resp["yape"] = {
            "numero":  cfg["YAPE_NUMERO"],
            "titular": cfg["YAPE_TITULAR"],
            "codigo":  ref,
            "monto":   data.monto,
            "moneda":  data.moneda,
            "instrucciones": [
                "Abre tu app de Yape y elige 'Yapear'.",
                f"Yapea al número {cfg['YAPE_NUMERO']} ({cfg['YAPE_TITULAR']}).",
                f"En el mensaje escribe el código {ref}.",
                "Vuelve aquí y presiona 'Ya pagué' para registrar tu apoyo.",
            ],
        }
    return jsonify(resp)


@bp_don.post("/donaciones/<don_id>/confirmar")
@require_auth
@require_cuenta_activa
def confirmar_yape(don_id):
    """El donante declara que ya yapeó -> 'confirmada' (demo). Solo el
    dueño de la donación puede confirmarla."""
    if not _UUID_RE.fullmatch(don_id):
        return jsonify(error="validation"), 400
    sb = client_service()
    row = (sb.table("donaciones").select("*")
             .eq("id", don_id).eq("id_donante", g.user["sub"])
             .limit(1).execute())
    if not row.data:
        return jsonify(error="not_found"), 404
    don = row.data[0]
    if don.get("metodo_pago") != "yape" or don["estado"] != "pendiente":
        return jsonify(error="estado_invalido",
                       detail="Solo donaciones Yape pendientes se pueden confirmar."), 409

    upd = (sb.table("donaciones").update({"estado": "confirmada"})
             .eq("id", don_id).execute())

    org_row = (sb.table("organizaciones").select("id,nombre,ubigeo")
                 .eq("id", don["id_organizacion"]).limit(1).execute())
    if org_row.data:
        org = org_row.data[0]
        dep = departamento_de(org["ubigeo"])
        donante = _nombre_donante(sb, g.user["sub"], don.get("es_anonima", False))
        publicar_evento(sb, "donacion",
                        titulo=f"Nueva donación en {dep}",
                        mensaje=f"{donante} apoyó a {org['nombre']} vía Yape",
                        departamento=dep,
                        monto=float(don["monto"]), moneda=don["moneda"])
    return jsonify(ok=True, donacion=upd.data[0] if upd.data else None)


@bp_don.get("/feed")
def feed():
    """Últimos eventos públicos (fallback de polling del feed realtime).
    Data ya anonimizada al escribirse -> lectura pública con anon key."""
    try:
        rows = (client_anon().table("eventos_feed")
                .select("id,tipo,titulo,mensaje,departamento,monto,moneda,created_at")
                .order("created_at", desc=True).limit(25).execute().data or [])
    except Exception:
        rows = []
    return jsonify(data=rows)


@bp_don.get("/mis-donaciones")
@require_auth
def mis_donaciones():
    """Historial del donador autenticado, con nombre de la organización."""
    sb = client_service()
    rows = (sb.table("donaciones")
              .select("*,organizaciones(nombre,ubigeo,tipo)")
              .eq("id_donante", g.user["sub"])
              .order("fecha", desc=True)
              .limit(200).execute().data or [])
    for r in rows:
        org = r.pop("organizaciones", None) or {}
        r["organizacion"] = org.get("nombre") or "Organización eliminada"
        r["organizacion_ubigeo"] = org.get("ubigeo")
        r["organizacion_tipo"] = org.get("tipo")
        r.setdefault("metodo_pago", "tarjeta")
        r.setdefault("es_anonima", False)
    return jsonify(data=rows,
                   resumen=resumen_donaciones(rows),
                   nivel=calcular_nivel(rows))
