"""
Subida de avatares a Supabase Storage (bucket público `avatares`).

Toda escritura pasa por aquí con la service key: el frontend nunca
escribe en storage directamente, así que el bucket no necesita
políticas de escritura para anon/authenticated.
"""
import base64
import binascii
import time

_EXT = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
MAX_BYTES = 1_500_000  # ~1.5 MB decodificados (el frontend comprime a ~256px)

_MAGIC = {
    "image/png":  [(0, b"\x89PNG")],
    "image/jpeg": [(0, b"\xff\xd8\xff")],
    "image/webp": [(0, b"RIFF"), (8, b"WEBP")],
}


class AvatarInvalido(ValueError):
    pass


def _validar_magic(data: bytes, mime: str) -> bool:
    for offset, signature in _MAGIC.get(mime, []):
        if data[offset:offset + len(signature)] != signature:
            return False
    return True


def subir_avatar(sb, carpeta: str, entidad_id: str, imagen_base64: str, mime: str) -> str:
    """Sube la imagen y devuelve su URL pública (con cache-bust)."""
    # data-URL o base64 pelado, ambos aceptados
    if "," in imagen_base64[:80]:
        imagen_base64 = imagen_base64.split(",", 1)[1]
    try:
        data = base64.b64decode(imagen_base64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise AvatarInvalido("base64 inválido") from e
    if not data or len(data) > MAX_BYTES:
        raise AvatarInvalido("imagen vacía o demasiado grande (máx 1.5 MB)")
    if not _validar_magic(data, mime):
        raise AvatarInvalido("el contenido no coincide con el tipo de imagen declarado")

    ext = _EXT[mime]
    ruta = f"{carpeta}/{entidad_id}.{ext}"
    bucket = sb.storage.from_("avatares")
    bucket.upload(ruta, data, {"content-type": mime, "x-upsert": "true"})

    url = bucket.get_public_url(ruta).rstrip("?")
    # cache-bust: mismo path en cada subida => forzar refresco del CDN
    return f"{url}?v={int(time.time())}"
