"""Imágenes privadas de transferencias. La imagen NO acredita un pago por sí sola."""
from io import BytesIO
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 5 * 1024 * 1024
FORMATOS = {'JPEG': ('jpg', 'image/jpeg'), 'PNG': ('png', 'image/png'), 'WEBP': ('webp', 'image/webp')}


def imagen_validada(archivo):
    if not archivo or not archivo.filename:
        raise ValueError('Adjunta un comprobante JPG, PNG o WEBP.')
    datos = archivo.read(MAX_BYTES + 1)
    if not datos:
        raise ValueError('El archivo está vacío.')
    if len(datos) > MAX_BYTES:
        raise ValueError('El comprobante debe pesar como máximo 5 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(datos)) as imagen:
                formato = imagen.format
                if formato not in FORMATOS:
                    raise ValueError('Solo se aceptan imágenes JPG, PNG o WEBP reales.')
                if imagen.width * imagen.height > 20_000_000:
                    raise ValueError('La imagen es demasiado grande. Usa una captura de hasta 20 megapíxeles.')
                imagen.verify()
            with Image.open(BytesIO(datos)) as original:
                original.load()
                imagen = ImageOps.exif_transpose(original)
                imagen = imagen.convert('RGB' if formato == 'JPEG' else 'RGBA')
                salida = BytesIO()
                imagen.save(salida, format=formato)
                limpio = salida.getvalue()
                if len(limpio) > MAX_BYTES:
                    raise ValueError('La imagen procesada supera 5 MB. Usa una captura más pequeña.')
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as exc:
        raise ValueError('No pudimos leer esa imagen. Adjunta una captura JPG, PNG o WEBP válida.') from exc
    extension, mime = FORMATOS[formato]
    return limpio, extension, mime
