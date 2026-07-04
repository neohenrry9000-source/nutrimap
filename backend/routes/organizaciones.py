"""
TIPOS DE API'S:

/api/organizaciones             GET  : lista pública (solo activas)
/api/organizaciones             POST : usuario org crea la suya (una sola)
/api/organizaciones/top         GET  : top público por recaudación
/api/mi-organizacion            GET  : la org del usuario actual
/api/mi-organizacion            PUT  : actualiza el perfil de la org
/api/mi-organizacion/donaciones GET  : donaciones recibidas + resumen
/api/mi-organizacion/finanzas   GET  : recaudado/retirado/disponible + meta
/api/mi-organizacion/retiros    GET/POST : historial y solicitud de retiro
/api/mi-organizacion/meta       POST : crear/actualizar meta de recaudación
/api/metas                      GET  : metas activas con progreso (público)
"""
import re
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from postgrest.exceptions import APIError
from pydantic import ValidationError

from services.security        import require_auth, require_role, require_cuenta_activa
from services.supabase_client import client_service
from services.donaciones      import resumen_donaciones
from services.feed            import publicar_evento
from services.finanzas        import calcular_finanzas, ESTADOS_INGRESO
from services.geo             import departamento_de, DEPARTAMENTOS
from services.storage         import subir_avatar, AvatarInvalido
from validators.schemas       import (OrgIn, OrgUpdateIn, RetiroIn, MetaIn,
                                      MetodoCobroIn, AvatarIn)

bp_org = Blueprint("org", __name__)

_PG_UNIQUE_VIOLATION = "23505"


def _errores(e: ValidationError):
    """Detalle serializable de un ValidationError de pydantic v2 (el
    ctx de los model_validator contiene ValueError, que rompe jsonify)."""
    return [{"campo": ".".join(str(p) for p in err.get("loc", [])),
             "msg": str(err.get("msg", ""))} for err in e.errors()]


def _mi_org(sb, campos="*"):
    res = (sb.table("organizaciones").select(campos)
             .eq("user_id", g.user["sub"]).limit(1).execute())
    return res.data[0] if res.data else None


def es_activa(entidad) -> bool:
    """Estado de moderación (compat: sin columna => activo)."""
    return (entidad.get("estado") or "activo") == "activo"


def _bloqueo_moderacion(org):
    """Respuesta 403 si la org está suspendida/baneada; None si opera."""
    if es_activa(org):
        return None
    baneada = (org.get("estado") == "baneado")
    return jsonify(
        error="organizacion_bloqueada" if baneada else "organizacion_suspendida",
        detail=("Tu organización fue bloqueada; contacta al administrador."
                if baneada else
                "Tu organización está suspendida temporalmente: puedes ver tu información e historial, pero no modificarla ni operar fondos."),
    ), 403


def _ingresos_por_org(sb, desde=None):
    """{id_organizacion: {moneda: total}} de donaciones en estado de ingreso.

    El filtro por estado se hace en Python (no en SQL) para tolerar una
    BD donde el enum aún no tiene 'confirmada' (pre-migración).
    """
    q = sb.table("donaciones").select("id_organizacion,monto,moneda,estado,fecha")
    if desde:
        q = q.gte("fecha", desde)
    acum = {}
    for d in (q.execute().data or []):
        if d["estado"] not in ESTADOS_INGRESO:
            continue
        org = acum.setdefault(d["id_organizacion"], {})
        org[d["moneda"]] = round(org.get(d["moneda"], 0) + float(d["monto"]), 2)
    return acum


# Campos que exponemos al público (nunca contacto/RUC/estado interno)
_CAMPOS_PUBLICOS = ("id", "nombre", "ubigeo", "lat", "lng", "nivel_necesidad",
                    "descripcion", "tipo", "activa", "avatar_url")


@bp_org.get("/organizaciones")
def listar():
    sb = client_service()
    # select("*") + proyección en Python: permite filtrar por estado de
    # moderación sin romper con BD pre-migración, sin exponer contacto.
    q = sb.table("organizaciones").select("*").eq("activa", True)

    ub = request.args.get("ubigeo", "")
    if ub:
        if not re.fullmatch(r"\d{6}", ub):
            return jsonify(error="ubigeo_invalido"), 400
        q = q.eq("ubigeo", ub)

    nec = request.args.get("nivel_min")
    if nec:
        try:
            q = q.gte("nivel_necesidad", int(nec))
        except ValueError:
            return jsonify(error="nivel_invalido"), 400

    res = q.limit(500).execute()
    # Moderación: suspendidas/baneadas fuera de la vista pública.
    visibles = [
        {k: o.get(k) for k in _CAMPOS_PUBLICOS}
        for o in (res.data or []) if es_activa(o)
    ]
    return jsonify(data=visibles)


@bp_org.post("/organizaciones")
@require_role("organizacion", "admin")
@require_cuenta_activa
def crear():
    try:
        data = OrgIn(**(request.get_json(silent=True) or {}))
    except ValidationError as e:
        return jsonify(error="validation", detail=_errores(e)), 400
    sb = client_service()

    # Registro único: una organización por usuario.
    ya = (sb.table("organizaciones").select("id")
            .eq("user_id", g.user["sub"]).limit(1).execute())
    if ya.data:
        return jsonify(error="ya_tienes_organizacion",
                       detail="Este usuario ya registró una organización; edítala desde tu panel."), 409

    # Campos None fuera del insert: compatibilidad con BD sin las
    # columnas nuevas y evita pisar defaults.
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    try:
        ins = sb.table("organizaciones").insert({
            **payload,
            "user_id": g.user["sub"],
        }).execute()
    except APIError as e:
        # Índices únicos en BD (user_id / nombre+ubigeo / ruc) como
        # respaldo contra carreras y duplicados.
        if getattr(e, "code", "") == _PG_UNIQUE_VIOLATION:
            return jsonify(error="organizacion_duplicada",
                           detail="Ya existe una organización con ese nombre en ese distrito (o ese RUC ya está registrado)."), 409
        raise

    org = ins.data[0]
    publicar_evento(sb, "organizacion",
                    titulo=f"Nueva organización en {departamento_de(org['ubigeo'])}",
                    mensaje=f"{org['nombre']} se inscribió en NutriMap",
                    departamento=departamento_de(org["ubigeo"]))
    return jsonify(data=org), 201


@bp_org.get("/mi-organizacion")
@require_role("organizacion", "admin")
def mi_get():
    sb = client_service()
    res = (sb.table("organizaciones").select("*")
             .eq("user_id", g.user["sub"]).limit(1).execute())
    return jsonify(data=(res.data[0] if res.data else None))


@bp_org.put("/mi-organizacion")
@require_role("organizacion", "admin")
@require_cuenta_activa
def mi_put():
    try:
        data = OrgUpdateIn(**(request.get_json(silent=True) or {}))
    except ValidationError as e:
        return jsonify(error="validation", detail=_errores(e)), 400

    # Solo los campos realmente enviados; user_id/id nunca son editables
    # porque OrgUpdateIn no los define.
    cambios = data.model_dump(exclude_unset=True)
    if not cambios:
        return jsonify(error="validation", detail="Nada que actualizar"), 400

    sb = client_service()
    org = _mi_org(sb)
    if org and (bloqueo := _bloqueo_moderacion(org)):
        return bloqueo
    try:
        res = (sb.table("organizaciones").update(cambios)
                 .eq("user_id", g.user["sub"]).execute())
    except APIError as e:
        if getattr(e, "code", "") == _PG_UNIQUE_VIOLATION:
            return jsonify(error="organizacion_duplicada",
                           detail="Ya existe una organización con ese nombre en ese distrito."), 409
        raise
    if not res.data:
        return jsonify(error="sin_organizacion",
                       detail="Aún no registraste una organización."), 404
    return jsonify(data=res.data[0])


@bp_org.get("/mi-organizacion/donaciones")
@require_role("organizacion", "admin")
def mi_donaciones_recibidas():
    sb = client_service()
    org = (sb.table("organizaciones").select("id,nombre")
             .eq("user_id", g.user["sub"]).limit(1).execute())
    if not org.data:
        return jsonify(error="sin_organizacion"), 404

    # Embed del donante: solo el nombre; nunca exponer email ni id.
    # es_anonima y metodo_pago son necesarios para enmascarar al donante
    # y mostrar el método; fallback si la BD aún no tiene esas columnas.
    def _consulta(campos):
        return (sb.table("donaciones").select(campos)
                  .eq("id_organizacion", org.data[0]["id"])
                  .order("fecha", desc=True)
                  .limit(200).execute().data or [])
    try:
        rows = _consulta("id,monto,moneda,estado,fecha,metodo_pago,"
                         "es_anonima,usuarios(nombre)")
    except APIError:
        rows = _consulta("id,monto,moneda,estado,fecha,usuarios(nombre)")
    for r in rows:
        donante = r.pop("usuarios", None) or {}
        # Anonimato: la organización tampoco ve el nombre real.
        if r.get("es_anonima"):
            r["donante"] = "Donante anónimo"
        else:
            r["donante"] = donante.get("nombre") or "Donante anónimo"
        r.setdefault("metodo_pago", "tarjeta")
    return jsonify(data=rows, resumen=resumen_donaciones(rows))


# ------------------------- FINANZAS / RETIROS -------------------------

@bp_org.get("/mi-organizacion/finanzas")
@require_role("organizacion", "admin")
def mis_finanzas():
    sb = client_service()
    org = _mi_org(sb)
    if not org:
        return jsonify(error="sin_organizacion"), 404

    finanzas = calcular_finanzas(sb, org["id"])

    meta = None
    try:
        m = (sb.table("metas").select("*")
               .eq("id_organizacion", org["id"]).eq("activa", True)
               .limit(1).execute())
        if m.data:
            meta = m.data[0]
            recaudos = _ingresos_por_org(sb, desde=meta["fecha_inicio"])
            meta["recaudado"] = recaudos.get(org["id"], {}).get(meta["moneda"], 0.0)
            objetivo = float(meta["objetivo_monto"])
            meta["progreso_pct"] = round(min(100.0, meta["recaudado"] / objetivo * 100), 1)
    except APIError:
        pass  # tabla metas aún no creada

    return jsonify(finanzas=finanzas, meta=meta)


@bp_org.get("/mi-organizacion/retiros")
@require_role("organizacion", "admin")
def listar_retiros():
    sb = client_service()
    org = _mi_org(sb)
    if not org:
        return jsonify(error="sin_organizacion"), 404
    try:
        rows = (sb.table("retiros").select("*")
                  .eq("id_organizacion", org["id"])
                  .order("fecha_solicitud", desc=True)
                  .limit(200).execute().data or [])
    except APIError:
        rows = []
    return jsonify(data=rows)


@bp_org.post("/mi-organizacion/retiros")
@require_role("organizacion", "admin")
def solicitar_retiro():
    try:
        data = RetiroIn(**(request.get_json(silent=True) or {}))
    except ValidationError:
        return jsonify(error="validation", detail="Datos inválidos"), 400

    sb = client_service()
    org = _mi_org(sb)
    if not org:
        return jsonify(error="sin_organizacion"), 404
    if (bloqueo := _bloqueo_moderacion(org)):
        return bloqueo

    # Chequeo en aplicación (mensaje claro) + trigger en BD (garantía
    # dura contra carreras): nunca se retira más de lo disponible.
    disponible = (calcular_finanzas(sb, org["id"])
                  .get(data.moneda, {}).get("disponible", 0.0))
    if data.monto > disponible:
        return jsonify(error="monto_excede_disponible",
                       detail=f"Disponible: {disponible:.2f} {data.moneda}."), 409

    try:
        ins = sb.table("retiros").insert({
            "id_organizacion": org["id"],
            "monto":  data.monto,
            "moneda": data.moneda,
            "nota":   data.nota or None,
            "fecha_solicitud": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except APIError as e:
        if "monto_excede_disponible" in str(e):
            return jsonify(error="monto_excede_disponible",
                           detail="El monto excede el saldo disponible."), 409
        raise
    return jsonify(ok=True, data=ins.data[0]), 201


# ------------------------------- METAS --------------------------------

@bp_org.post("/mi-organizacion/meta")
@require_role("organizacion", "admin")
def guardar_meta():
    """Crea o reemplaza la meta activa de la organización. Con
    activa=false solo desactiva la vigente."""
    try:
        data = MetaIn(**(request.get_json(silent=True) or {}))
    except ValidationError:
        return jsonify(error="validation", detail="Datos inválidos"), 400

    sb = client_service()
    org = _mi_org(sb)
    if not org:
        return jsonify(error="sin_organizacion"), 404
    if (bloqueo := _bloqueo_moderacion(org)):
        return bloqueo

    actual = (sb.table("metas").select("id")
                .eq("id_organizacion", org["id"]).eq("activa", True)
                .limit(1).execute())
    if actual.data:
        if not data.activa:
            sb.table("metas").update({"activa": False}) \
              .eq("id", actual.data[0]["id"]).execute()
            return jsonify(ok=True, data=None)
        upd = sb.table("metas").update({
            "titulo": data.titulo,
            "descripcion": data.descripcion or None,
            "objetivo_monto": data.objetivo_monto,
            "moneda": data.moneda,
        }).eq("id", actual.data[0]["id"]).execute()
        return jsonify(ok=True, data=upd.data[0])

    if not data.activa:
        return jsonify(ok=True, data=None)
    ins = sb.table("metas").insert({
        "tipo": "organizacion",
        "id_organizacion": org["id"],
        "titulo": data.titulo,
        "descripcion": data.descripcion or None,
        "objetivo_monto": data.objetivo_monto,
        "moneda": data.moneda,
    }).execute()
    return jsonify(ok=True, data=ins.data[0]), 201


@bp_org.get("/metas")
def metas_publicas():
    """Metas activas con progreso calculado. Público: alimenta las
    barras de recaudación de cards, paneles y strip global."""
    sb = client_service()
    try:
        metas = (sb.table("metas").select("*")
                   .eq("activa", True).limit(100).execute().data or [])
    except APIError:
        return jsonify(data=[])
    if not metas:
        return jsonify(data=[])

    ingresos = _ingresos_por_org(sb)          # todo histórico, por org
    orgs = (sb.table("organizaciones").select("id,ubigeo,nombre")
              .execute().data or [])
    ubigeo_por_org = {o["id"]: str(o["ubigeo"]).zfill(6) for o in orgs}
    nombre_por_org = {o["id"]: o["nombre"] for o in orgs}

    for m in metas:
        moneda = m["moneda"]
        if m["tipo"] == "organizacion":
            total = ingresos.get(m["id_organizacion"], {}).get(moneda, 0.0)
            m["organizacion_nombre"] = nombre_por_org.get(m["id_organizacion"])
        elif m["tipo"] == "departamento":
            total = sum(v.get(moneda, 0.0) for oid, v in ingresos.items()
                        if ubigeo_por_org.get(oid, "").startswith(m["departamento"]))
            m["departamento_nombre"] = DEPARTAMENTOS.get(m["departamento"], "")
        else:  # global
            total = sum(v.get(moneda, 0.0) for v in ingresos.values())
        m["recaudado"] = round(total, 2)
        objetivo = float(m["objetivo_monto"])
        m["progreso_pct"] = round(min(100.0, total / objetivo * 100), 1)
    return jsonify(data=metas)


@bp_org.post("/mi-organizacion/avatar")
@require_role("organizacion", "admin")
def avatar_org():
    try:
        data = AvatarIn(**(request.get_json(silent=True) or {}))
    except ValidationError:
        return jsonify(error="validation", detail="Imagen inválida"), 400
    sb = client_service()
    org = _mi_org(sb)
    if not org:
        return jsonify(error="sin_organizacion"), 404
    if (bloqueo := _bloqueo_moderacion(org)):
        return bloqueo
    try:
        url = subir_avatar(sb, "organizaciones", org["id"],
                           data.imagen_base64, data.mime)
    except AvatarInvalido as e:
        return jsonify(error="validation", detail=str(e)), 400
    sb.table("organizaciones").update({"avatar_url": url}) \
      .eq("id", org["id"]).execute()
    return jsonify(ok=True, avatar_url=url)


# ------------------------- MÉTODOS DE COBRO ---------------------------
# Datos sensibles (cuentas/Yape): RLS sin políticas, solo backend.
# Los ve la organización dueña y el admin al revisar retiros.

@bp_org.get("/mi-organizacion/metodos-cobro")
@require_role("organizacion", "admin")
def listar_metodos():
    sb = client_service()
    org = _mi_org(sb)
    if not org:
        return jsonify(error="sin_organizacion"), 404
    try:
        rows = (sb.table("metodos_cobro").select("*")
                  .eq("id_organizacion", org["id"])
                  .order("principal", desc=True)
                  .order("created_at", desc=True).execute().data or [])
    except APIError:
        rows = []
    return jsonify(data=rows)


def _guardar_metodo(sb, org_id, data: MetodoCobroIn, metodo_id=None):
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    payload["principal"] = data.principal
    if data.principal:
        # solo un principal por org (además del índice único en BD)
        sb.table("metodos_cobro").update({"principal": False}) \
          .eq("id_organizacion", org_id).eq("principal", True).execute()
    if metodo_id:
        return (sb.table("metodos_cobro").update(payload)
                  .eq("id", metodo_id).eq("id_organizacion", org_id).execute())
    return sb.table("metodos_cobro").insert(
        {**payload, "id_organizacion": org_id}).execute()


@bp_org.post("/mi-organizacion/metodos-cobro")
@require_role("organizacion", "admin")
def crear_metodo():
    try:
        data = MetodoCobroIn(**(request.get_json(silent=True) or {}))
    except ValidationError as e:
        return jsonify(error="validation", detail=_errores(e)), 400
    sb = client_service()
    org = _mi_org(sb)
    if not org:
        return jsonify(error="sin_organizacion"), 404
    if (bloqueo := _bloqueo_moderacion(org)):
        return bloqueo
    ins = _guardar_metodo(sb, org["id"], data)
    return jsonify(ok=True, data=ins.data[0]), 201


@bp_org.put("/mi-organizacion/metodos-cobro/<metodo_id>")
@require_role("organizacion", "admin")
def editar_metodo(metodo_id):
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", metodo_id):
        return jsonify(error="validation"), 400
    try:
        data = MetodoCobroIn(**(request.get_json(silent=True) or {}))
    except ValidationError as e:
        return jsonify(error="validation", detail=_errores(e)), 400
    sb = client_service()
    org = _mi_org(sb)
    if not org:
        return jsonify(error="sin_organizacion"), 404
    if (bloqueo := _bloqueo_moderacion(org)):
        return bloqueo
    upd = _guardar_metodo(sb, org["id"], data, metodo_id=metodo_id)
    if not upd.data:
        return jsonify(error="not_found"), 404
    return jsonify(ok=True, data=upd.data[0])


@bp_org.delete("/mi-organizacion/metodos-cobro/<metodo_id>")
@require_role("organizacion", "admin")
def borrar_metodo(metodo_id):
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", metodo_id):
        return jsonify(error="validation"), 400
    sb = client_service()
    org = _mi_org(sb)
    if not org:
        return jsonify(error="sin_organizacion"), 404
    if (bloqueo := _bloqueo_moderacion(org)):
        return bloqueo
    res = (sb.table("metodos_cobro").delete()
             .eq("id", metodo_id).eq("id_organizacion", org["id"]).execute())
    if not res.data:
        return jsonify(error="not_found"), 404
    return jsonify(ok=True)


@bp_org.get("/organizaciones/top")
def top_organizaciones():
    """Top 5 público por recaudación (solo orgs activas; sin datos de
    donantes)."""
    sb = client_service()
    ingresos = _ingresos_por_org(sb)
    orgs = [o for o in (sb.table("organizaciones").select("*")
                          .eq("activa", True).execute().data or [])
            if es_activa(o)]
    ranking = []
    for o in orgs:
        tot = ingresos.get(o["id"], {})
        total_pen = tot.get("PEN", 0.0)
        if total_pen <= 0 and not tot:
            continue
        ranking.append({
            "id": o["id"], "nombre": o["nombre"],
            "ubigeo": str(o["ubigeo"]).zfill(6),
            "departamento": departamento_de(o["ubigeo"]),
            "tipo": o["tipo"],
            "total_pen": round(total_pen, 2),
            "totales": tot,
        })
    ranking.sort(key=lambda r: r["total_pen"], reverse=True)
    return jsonify(data=ranking[:5])
