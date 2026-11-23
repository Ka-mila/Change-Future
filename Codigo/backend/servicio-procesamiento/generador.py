"""Convierte una imagen en un modelo 3D imprimible (STL binario).

Dos estilos:
- silueta: separa la figura del fondo y la extruye como una pieza plana
  (llaveros, placas, figuras recortadas).
- relieve: las zonas claras quedan más altas que las oscuras
  (cuadros en relieve, placas con fotos).

El lado más largo del modelo mide LADO_BASE_MM. El tamaño elegido por el
cliente se aplica después, escalando ancho y alto.
"""
import io

import numpy as np
from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError

LADO_BASE_MM = 100.0
GROSOR_SILUETA_MM = 4.0
BASE_RELIEVE_MM = 1.6
ALTURA_RELIEVE_MM = 3.0
RESOLUCION_SILUETA = 170
RESOLUCION_RELIEVE = 140

Image.MAX_IMAGE_PIXELS = 40_000_000


class ErrorProcesamiento(Exception):
    """Error con un mensaje que se puede mostrar al cliente."""


def abrir_imagen(datos):
    try:
        imagen = Image.open(io.BytesIO(datos))
        imagen.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ErrorProcesamiento('No pudimos leer la imagen. Prueba con otro archivo JPG, PNG o WEBP.')
    return ImageOps.exif_transpose(imagen).convert('RGBA')


def generar_modelo(datos, estilo):
    """Devuelve (bytes del STL, {'ancho_mm', 'alto_mm', 'profundidad_mm'})."""
    imagen = abrir_imagen(datos)
    if estilo == 'silueta':
        triangulos = _silueta(imagen)
    elif estilo == 'relieve':
        triangulos = _relieve(imagen)
    else:
        raise ErrorProcesamiento('Estilo no válido: elige silueta o relieve.')

    # Centrar en X e Y, apoyado en Z = 0
    minimo, maximo = triangulos.reshape(-1, 3).min(axis=0), triangulos.reshape(-1, 3).max(axis=0)
    triangulos[..., 0] -= (minimo[0] + maximo[0]) / 2
    triangulos[..., 1] -= (minimo[1] + maximo[1]) / 2
    medidas = maximo - minimo
    return _a_stl(triangulos), {
        'ancho_mm': round(float(medidas[0]), 1),
        'alto_mm': round(float(medidas[1]), 1),
        'profundidad_mm': round(float(medidas[2]), 1),
    }


# ---------- Silueta ----------

def _mascara(imagen):
    """True donde está la figura. Usa la transparencia o, si no hay, el color del borde como fondo."""
    imagen.thumbnail((400, 400))
    rgba = np.asarray(imagen).astype(np.float32)
    alfa = rgba[..., 3]

    if (alfa < 128).mean() > 0.01:
        mascara = alfa >= 128
    else:
        rgb = rgba[..., :3]
        borde = max(2, int(min(rgb.shape[:2]) * 0.03))
        marco = np.concatenate([
            rgb[:borde].reshape(-1, 3), rgb[-borde:].reshape(-1, 3),
            rgb[:, :borde].reshape(-1, 3), rgb[:, -borde:].reshape(-1, 3),
        ])
        fondo = np.median(marco, axis=0)
        distancia = np.linalg.norm(rgb - fondo, axis=2)
        mascara = distancia > max(_umbral_otsu(distancia), 25.0)

    # Quitar puntos sueltos y suavizar el contorno
    limpia = Image.fromarray((mascara * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))
    return np.asarray(limpia) > 127


def _umbral_otsu(valores):
    histograma, bordes = np.histogram(valores, bins=256)
    centros = (bordes[:-1] + bordes[1:]) / 2
    peso = np.cumsum(histograma)
    media = np.cumsum(histograma * centros)
    total, media_total = peso[-1], media[-1]
    peso_fondo = peso[:-1]
    peso_figura = total - peso_fondo
    validos = (peso_fondo > 0) & (peso_figura > 0)
    media_fondo = media[:-1] / np.where(peso_fondo == 0, 1, peso_fondo)
    media_figura = (media_total - media[:-1]) / np.where(peso_figura == 0, 1, peso_figura)
    varianza = np.where(validos, peso_fondo * peso_figura * (media_fondo - media_figura) ** 2, 0)
    return float(centros[np.argmax(varianza)])


def _silueta(imagen):
    mascara = _mascara(imagen)
    proporcion = mascara.mean()
    if proporcion < 0.02:
        raise ErrorProcesamiento(
            'No encontramos una figura en la imagen. Usa una foto con fondo liso o prueba el estilo Relieve.')
    if proporcion > 0.95:
        raise ErrorProcesamiento(
            'No pudimos separar la figura del fondo. Usa una imagen con fondo liso o prueba el estilo Relieve.')

    # Recortar a la figura y bajar a la resolución de impresión
    filas, columnas = np.where(mascara)
    mascara = mascara[filas.min():filas.max() + 1, columnas.min():columnas.max() + 1]
    alto, ancho = mascara.shape
    escala = RESOLUCION_SILUETA / max(alto, ancho)
    tamano = (max(1, round(ancho * escala)), max(1, round(alto * escala)))
    reducida = Image.fromarray((mascara * 255).astype(np.uint8)).resize(tamano, Image.LANCZOS)
    celdas = np.asarray(reducida) > 127

    return _extruir(celdas, LADO_BASE_MM / max(celdas.shape), GROSOR_SILUETA_MM)


def _extruir(celdas, lado, grosor):
    """Cada celda llena es un prisma; solo se crean las paredes que dan al exterior."""
    alto = celdas.shape[0]
    vecinas = np.pad(celdas, 1, constant_values=False)
    i, j = np.nonzero(celdas)
    x0, x1 = j * lado, (j + 1) * lado
    y0, y1 = (alto - i - 1) * lado, (alto - i) * lado
    cero, arriba = np.zeros_like(x0, dtype=float), np.full_like(x0, grosor, dtype=float)

    def punto(x, y, z):
        return np.stack([x, y, z], axis=-1)

    caras = [
        (punto(x0, y0, arriba), punto(x1, y0, arriba), punto(x1, y1, arriba), punto(x0, y1, arriba)),  # arriba
        (punto(x0, y0, cero), punto(x0, y1, cero), punto(x1, y1, cero), punto(x1, y0, cero)),  # abajo
    ]
    paredes = [
        (~vecinas[i + 1, j + 2], lambda: (punto(x1, y0, cero), punto(x1, y1, cero), punto(x1, y1, arriba), punto(x1, y0, arriba))),
        (~vecinas[i + 1, j], lambda: (punto(x0, y1, cero), punto(x0, y0, cero), punto(x0, y0, arriba), punto(x0, y1, arriba))),
        (~vecinas[i, j + 1], lambda: (punto(x1, y1, cero), punto(x0, y1, cero), punto(x0, y1, arriba), punto(x1, y1, arriba))),
        (~vecinas[i + 2, j + 1], lambda: (punto(x0, y0, cero), punto(x1, y0, cero), punto(x1, y0, arriba), punto(x0, y0, arriba))),
    ]
    for expuesta, crear in paredes:
        caras.append(tuple(p[expuesta] for p in crear()))

    return np.concatenate([_cuadrado_a_triangulos(*cara) for cara in caras])


def _cuadrado_a_triangulos(p0, p1, p2, p3):
    return np.concatenate([np.stack([p0, p1, p2], axis=1), np.stack([p0, p2, p3], axis=1)])


# ---------- Relieve ----------

def _relieve(imagen):
    fondo = Image.new('RGBA', imagen.size, (0, 0, 0, 255))
    gris = Image.alpha_composite(fondo, imagen).convert('L')
    gris = ImageOps.autocontrast(gris, cutoff=1)
    gris.thumbnail((RESOLUCION_RELIEVE, RESOLUCION_RELIEVE), Image.LANCZOS)
    gris = gris.filter(ImageFilter.GaussianBlur(0.8))

    valores = np.asarray(gris).astype(np.float32) / 255
    if valores.shape[0] < 4 or valores.shape[1] < 4:
        raise ErrorProcesamiento('La imagen es demasiado pequeña. Usa una de al menos 100 × 100 píxeles.')
    if valores.std() < 0.02:
        raise ErrorProcesamiento('La imagen es de un solo tono y no tiene detalles para el relieve.')

    alturas = BASE_RELIEVE_MM + ALTURA_RELIEVE_MM * valores
    return _superficie_cerrada(alturas, LADO_BASE_MM / (max(valores.shape) - 1))


def _superficie_cerrada(alturas, paso):
    """Malla cerrada: superficie de alturas arriba, base plana abajo y paredes alrededor."""
    filas, columnas = alturas.shape
    jj, ii = np.meshgrid(np.arange(columnas), np.arange(filas))
    arriba = np.stack([jj * paso, (filas - 1 - ii) * paso, alturas], axis=-1)

    a, b = arriba[:-1, :-1], arriba[:-1, 1:]  # fila de arriba de cada celda
    c, d = arriba[1:, :-1], arriba[1:, 1:]    # fila de abajo
    superficie = np.concatenate([
        np.stack([a, c, b], axis=-2).reshape(-1, 3, 3),
        np.stack([b, c, d], axis=-2).reshape(-1, 3, 3),
    ])

    # Contorno en sentido antihorario visto desde arriba
    contorno = np.concatenate([
        arriba[-1, :], arriba[-2::-1, -1], arriba[0, -2::-1], arriba[1:-1, 0],
    ])
    siguiente = np.roll(contorno, -1, axis=0)
    base_a, base_b = contorno.copy(), siguiente.copy()
    base_a[:, 2] = 0
    base_b[:, 2] = 0
    paredes = np.concatenate([
        np.stack([contorno, base_a, base_b], axis=1),
        np.stack([contorno, base_b, siguiente], axis=1),
    ])

    centro = np.array([(columnas - 1) * paso / 2, (filas - 1) * paso / 2, 0.0])
    piso = np.stack([np.broadcast_to(centro, base_a.shape), base_b, base_a], axis=1)

    return np.concatenate([superficie, paredes, piso])


# ---------- STL ----------

def _a_stl(triangulos):
    triangulos = triangulos.astype(np.float32)
    normales = np.cross(triangulos[:, 1] - triangulos[:, 0], triangulos[:, 2] - triangulos[:, 0])
    largo = np.linalg.norm(normales, axis=1, keepdims=True)
    normales = normales / np.where(largo == 0, 1, largo)

    registro = np.dtype([('normal', '<f4', 3), ('vertices', '<f4', (3, 3)), ('atributo', '<u2')])
    datos = np.zeros(len(triangulos), dtype=registro)
    datos['normal'] = normales
    datos['vertices'] = triangulos

    encabezado = b'Change Future - propuesta de diseno'.ljust(80, b' ')
    return encabezado + np.uint32(len(triangulos)).tobytes() + datos.tobytes()
