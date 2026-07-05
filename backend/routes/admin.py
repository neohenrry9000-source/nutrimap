"""
Panel de administración (solo rol admin; el frontend puede ocultar el
enlace, pero la garantía real es require_role en cada endpoint).

/api/admin/resumen        GET  : métricas globales + actividad reciente
/api/admin/retiros        GET  : solicitudes con org, saldo y métodos de cobro
/api/admin/retiros/<id>   POST : aprobar / observar / rechazar / completar

Trazabilidad: cada acción guarda procesado_por + nota_admin + timestamp
en el retiro, y una fila en auditoria_eventos.
"""
import re
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from postgrest.exceptions import APIError
from pydantic import ValidationError

from services.security        import require_role
from services.supabase_client import client_service
from services.finanzas        import calcular_finanzas, ESTADOS_INGRESO
from services.geo             import departamento_de
from validators.schemas       import RetiroAccionIn, ModeracionIn

bp_admin = Blueprint("admin", __name__)

_UUID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")

# Transiciones válidas del flujo de aprobación
TRANSICIONES = {
    "aprobar":   {"desde": ("pendiente", "observado"), "a": "aprobado"},
    "observar":  {"desde": ("pendiente", "aprobado"),  "a": "observado"},
    "rechazar":  {"desde": ("pendiente", "observado", "aprobado"), "a": "rechazado"},
    "completar": {"desde": ("aprobado",), "a": "completado"},
}

# Moderación: acción -> estado resultante
ACCION_A_ESTADO = {"suspender": "suspendido", "banear": "baneado", "reactivar": "activo"}
_TABLA_MODERABLE = {"usuario": "usuarios", "organizacion": "organizaciones"}


def _estado_de(entidad):
    return (entidad.get("estado") or "activo")


def _auditar(sb, accion, recurso, meta):
    try:
        sb.table("auditoria_eventos").insert({
            "actor_id": g.user["sub"],
            "accion":   accion,
            "recurso":  recurso,
            "ua":       request.headers.get("User-Agent", "")[:300],
            "meta":     meta,
        }).execute()
    except Exception:
        pass  # la auditoría nunca debe tumbar la operación


@bp_admin.get("/admin/resumen")
@require_role("admin")
def resumen():
    sb = client_service()

    usuarios = sb.table("usuarios").select("rol").execute().data or []
    orgs = sb.table("organizaciones").select("id,activa").execute().data or []
    dons = sb.table("donaciones").select("monto,moneda,estado").execute().data or []

    total_donado, donaciones_ingresadas = {}, 0
    for d in dons:
        if d["estado"] in ESTADOS_INGRESO:
            donaciones_ingresadas += 1
            m = d["moneda"]
            total_donado[m] = round(total_donado.get(m, 0) + float(d["monto"]), 2)

    retiros_stats, total_retirado, ultimos_retiros = {}, {}, []
    try:
        rets = (sb.table("retiros")
                  .select("id,monto,moneda,estado,fecha_solicitud")
                  .order("fecha_solicitud", desc=True).execute().data or [])
        for r in rets:
            retiros_stats[r["estado"]] = retiros_stats.get(r["estado"], 0) + 1
            if r["estado"] == "completado":
                m = r["moneda"]
                total_retirado[m] = round(total_retirado.get(m, 0) + float(r["monto"]), 2)
        ultimos_retiros = rets[:5]
    except APIError:
        pass

    try:
        actividad = (sb.table("eventos_feed")
                       .select("id,tipo,titulo,mensaje,created_at")
                       .order("created_at", desc=True).limit(10).execute().data or [])
    except APIError:
        actividad = []

    return jsonify(data={
        "total_donado":          total_donado,
        "donaciones_ingresadas": donaciones_ingresadas,
        "total_retirado":        total_retirado,
        "retiros_por_estado":    retiros_stats,
        "retiros_pendientes":    retiros_stats.get("pendiente", 0) + retiros_stats.get("observado", 0),
        "organizaciones":        len(orgs),
        "organizaciones_activas": sum(1 for o in orgs if o["activa"]),
        "donadores":             sum(1 for u in usuarios if u["rol"] == "donador"),
        "admins":                sum(1 for u in usuarios if u["rol"] == "admin"),
        "ultimos_retiros":       ultimos_retiros,
        "actividad":             actividad,
    })


@bp_admin.get("/admin/retiros")
@require_role("admin")
def listar_retiros():
    sb = client_service()
    estado = request.args.get("estado", "")

    q = sb.table("retiros").select("*").order("fecha_solicitud", desc=True).limit(200)
    if estado:
        if estado not in ("pendiente", "aprobado", "observado", "completado", "rechazado"):
            return jsonify(error="estado_invalido"), 400
        q = q.eq("estado", estado)
    try:
        retiros = q.execute().data or []
    except APIError:
        return jsonify(data=[])

    org_ids = list({r["id_organizacion"] for r in retiros})
    orgs, metodos = {}, {}
    if org_ids:
        for o in (sb.table("organizaciones")
                    .select("id,nombre,ubigeo,tipo,email_contacto,telefono")
                    .in_("id", org_ids).execute().data or []):
            orgs[o["id"]] = o
        try:
            for m in (sb.table("metodos_cobro").select("*")
                        .in_("id_organizacion", org_ids)
                        .order("principal", desc=True).execute().data or []):
                metodos.setdefault(m["id_organizacion"], []).append(m)
        except APIError:
            pass

    finanzas_cache = {}
    for r in retiros:
        oid = r["id_organizacion"]
        o = orgs.get(oid, {})
        r["organizacion"] = {
            "id": oid,
            "nombre": o.get("nombre", "Organización eliminada"),
            "departamento": departamento_de(o.get("ubigeo", "")),
            "tipo": o.get("tipo"),
            "email_contacto": o.get("email_contacto"),
            "telefono": o.get("telefono"),
        }
        if oid not in finanzas_cache:
            finanzas_cache[oid] = calcular_finanzas(sb, oid)
        r["disponible_org"] = finanzas_cache[oid].get(r["moneda"], {}).get("disponible", 0.0)
        r["metodos_cobro"] = metodos.get(oid, [])
    return jsonify(data=retiros)


@bp_admin.post("/admin/retiros/<retiro_id>")
@require_role("admin")
def accionar_retiro(retiro_id):
    if not _UUID_RE.fullmatch(retiro_id):
        return jsonify(error="validation"), 400
    try:
        data = RetiroAccionIn(**(request.get_json(silent=True) or {}))
    except ValidationError:
        return jsonify(error="validation", detail="Datos inválidos"), 400

    sb = client_service()
    row = sb.table("retiros").select("*").eq("id", retiro_id).limit(1).execute()
    if not row.data:
        return jsonify(error="not_found"), 404
    retiro = row.data[0]

    regla = TRANSICIONES[data.accion]
    if retiro["estado"] not in regla["desde"]:
        return jsonify(
            error="transicion_invalida",
            detail=f"No se puede {data.accion} un retiro en estado '{retiro['estado']}'.",
        ), 409

    cambios = {
        "estado":              regla["a"],
        "nota_admin":          data.nota or None,
        "procesado_por":       g.user["sub"],
        "fecha_procesamiento": datetime.now(timezone.utc).isoformat(),
    }
    upd = sb.table("retiros").update(cambios).eq("id", retiro_id).execute()

    _auditar(sb, f"retiro_{data.accion}", f"retiros/{retiro_id}", {
        "estado_anterior": retiro["estado"],
        "estado_nuevo":    regla["a"],
        "monto":           float(retiro["monto"]),
        "moneda":          retiro["moneda"],
        "id_organizacion": retiro["id_organizacion"],
        "nota":            data.nota or None,
    })
    return jsonify(ok=True, data=upd.data[0] if upd.data else None)


# ----------------------------- MODERACIÓN -----------------------------

@bp_admin.get("/admin/usuarios")
@require_role("admin")
def listar_usuarios():
    """Listado de usuarios para moderar (búsqueda + filtro por estado)."""
    sb = client_service()
    q = (request.args.get("q") or "").strip().lower()
    estado = request.args.get("estado", "")
    rol = request.args.get("rol", "")

    rows = sb.table("usuarios").select("*").execute().data or []
    out = []
    for u in rows:
        u.pop("password_hash", None)  # jamás sale del backend
        u["estado"] = _estado_de(u)
        if estado and u["estado"] != estado:
            continue
        if rol and u["rol"] != rol:
            continue
        if q and q not in f"{u.get('email','')} {u.get('nombre','')}".lower():
            continue
        out.append(u)
    out.sort(key=lambda u: u.get("created_at") or "", reverse=True)
    return jsonify(data=out[:200])


@bp_admin.get("/admin/organizaciones")
@require_role("admin")
def listar_organizaciones_admin():
    """Listado completo de organizaciones (incluye suspendidas/baneadas
    e inactivas) con el email del dueño."""
    sb = client_service()
    q = (request.args.get("q") or "").strip().lower()
    estado = request.args.get("estado", "")

    orgs = sb.table("organizaciones").select("*").execute().data or []
    duenos = {u["id"]: u.get("email") for u in
              (sb.table("usuarios").select("*").execute().data or [])}
    out = []
    for o in orgs:
        o["estado"] = _estado_de(o)
        o["dueno_email"] = duenos.get(o.get("user_id"))
        o["departamento"] = departamento_de(o.get("ubigeo", ""))
        if estado and o["estado"] != estado:
            continue
        if q and q not in f"{o.get('nombre','')} {o.get('dueno_email','')} {o.get('ruc','')}".lower():
            continue
        out.append(o)
    out.sort(key=lambda o: o.get("created_at") or "", reverse=True)
    return jsonify(data=out[:200])


@bp_admin.post("/admin/moderar")
@require_role("admin")
def moderar():
    """Suspende / banea / reactiva un usuario o una organización.

    Nunca borra nada: cambia el estado y deja evidencia en
    moderacion_eventos + auditoria_eventos.
    """
    try:
        data = ModeracionIn(**(request.get_json(silent=True) or {}))
    except ValidationError:
        return jsonify(error="validation", detail="Datos inválidos (el motivo es obligatorio, mín. 5 caracteres)."), 400

    sb = client_service()
    tabla = _TABLA_MODERABLE[data.tipo]
    row = sb.table(tabla).select("*").eq("id", data.id).limit(1).execute()
    if not row.data:
        return jsonify(error="not_found"), 404
    entidad = row.data[0]

    # Salvaguardas: los admins no se moderan entre sí ni a sí mismos.
    if data.tipo == "usuario":
        if entidad.get("rol") == "admin":
            return jsonify(error="no_moderable",
                           detail="Las cuentas admin no se moderan desde el panel."), 403
        if entidad["id"] == g.user["sub"]:
            return jsonify(error="no_moderable", detail="No puedes moderarte a ti mismo."), 403

    estado_previo = _estado_de(entidad)
    estado_nuevo = ACCION_A_ESTADO[data.accion]
    if estado_previo == estado_nuevo:
        return jsonify(error="sin_cambio",
                       detail=f"La entidad ya está en estado '{estado_nuevo}'."), 409

    try:
        upd = sb.table(tabla).update({"estado": estado_nuevo}) \
                .eq("id", data.id).execute()
    except APIError:
        return jsonify(error="migracion_pendiente",
                       detail="Ejecuta sql/fase_moderacion.sql en Supabase."), 503

    # Trazabilidad dedicada (además de auditoria_eventos)
    try:
        sb.table("moderacion_eventos").insert({
            "tipo_entidad":  data.tipo,
            "entidad_id":    data.id,
            "accion":        data.accion,
            "estado_previo": estado_previo,
            "motivo":        data.motivo,
            "realizado_por": g.user["sub"],
        }).execute()
    except APIError:
        pass  # tabla aún no creada: la auditoría general igual registra

    _auditar(sb, f"moderacion_{data.accion}", f"{tabla}/{data.id}", {
        "estado_previo": estado_previo,
        "estado_nuevo":  estado_nuevo,
        "motivo":        data.motivo,
    })

    actualizado = upd.data[0] if upd.data else None
    if actualizado:
        actualizado.pop("password_hash", None)
    return jsonify(ok=True, data=actualizado)


@bp_admin.get("/admin/moderacion/<tipo>/<entidad_id>")
@require_role("admin")
def historial_moderacion(tipo, entidad_id):
    if tipo not in _TABLA_MODERABLE or not _UUID_RE.fullmatch(entidad_id):
        return jsonify(error="validation"), 400
    sb = client_service()
    try:
        rows = (sb.table("moderacion_eventos").select("*")
                  .eq("tipo_entidad", tipo).eq("entidad_id", entidad_id)
                  .order("created_at", desc=True).limit(100).execute().data or [])
    except APIError:
        rows = []
    return jsonify(data=rows)
