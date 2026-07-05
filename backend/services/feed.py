"""
Feed de eventos públicos (tabla eventos_feed + Supabase Realtime).

Regla de privacidad: aquí se escribe SOLO información ya apta para el
público. Nunca pasar id/email del donante; si la donación es anónima,
el llamador debe enviar "Donante anónimo" como etiqueta.

Si la tabla aún no existe (SQL de evolución sin aplicar), el evento se
descarta con un warning: el feed jamás debe tumbar el flujo principal.
"""
from flask import current_app


def publicar_evento(sb, tipo, titulo, mensaje=None, departamento=None,
                    monto=None, moneda=None):
    fila = {"tipo": tipo, "titulo": titulo}
    if mensaje:
        fila["mensaje"] = mensaje
    if departamento:
        fila["departamento"] = departamento
    if monto is not None:
        fila["monto"] = monto
        fila["moneda"] = moneda or "PEN"
    try:
        sb.table("eventos_feed").insert(fila).execute()
    except Exception:
        current_app.logger.warning("eventos_feed no disponible; evento descartado")
