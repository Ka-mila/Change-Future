import io
from collections import Counter

import numpy as np
import pytest
from PIL import Image, ImageDraw

from app import create_app
from generador import ErrorProcesamiento, generar_modelo


def png(imagen):
    salida = io.BytesIO()
    imagen.save(salida, format='PNG')
    return salida.getvalue()


def circulo_sobre_fondo_blanco():
    imagen = Image.new('RGB', (300, 200), 'white')
    ImageDraw.Draw(imagen).ellipse((50, 30, 250, 170), fill=(160, 40, 200))
    return png(imagen)


def degradado():
    datos = np.tile(np.linspace(0, 255, 200, dtype=np.uint8), (150, 1))
    return png(Image.fromarray(datos))


def leer_stl(stl):
    cantidad = int(np.frombuffer(stl[80:84], dtype='<u4')[0])
    registro = np.dtype([('normal', '<f4', 3), ('vertices', '<f4', (3, 3)), ('atributo', '<u2')])
    datos = np.frombuffer(stl[84:], dtype=registro)
    assert len(datos) == cantidad
    return datos['vertices']


def es_cerrado(triangulos):
    """Cada arista dirigida debe tener su gemela en sentido contrario (malla cerrada y bien orientada)."""
    aristas = Counter()
    for tri in np.round(triangulos, 4):
        puntos = [tuple(p) for p in tri]
        for k in range(3):
            aristas[(puntos[k], puntos[(k + 1) % 3])] += 1
    return all(aristas[(b, a)] == n for (a, b), n in aristas.items())


def volumen(triangulos):
    a, b, c = triangulos[:, 0].astype(float), triangulos[:, 1].astype(float), triangulos[:, 2].astype(float)
    return float(np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6)


def test_silueta_genera_pieza_cerrada_con_medidas():
    stl, medidas = generar_modelo(circulo_sobre_fondo_blanco(), 'silueta')
    triangulos = leer_stl(stl)
    assert es_cerrado(triangulos)
    assert volumen(triangulos) > 0  # normales hacia afuera
    assert medidas['ancho_mm'] == 100.0
    assert 65 < medidas['alto_mm'] < 75  # proporción de la elipse 200 × 140
    assert medidas['profundidad_mm'] == 4.0


def test_silueta_usa_transparencia():
    imagen = Image.new('RGBA', (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(imagen).rectangle((50, 20, 150, 180), fill=(255, 0, 0, 255))
    _, medidas = generar_modelo(png(imagen), 'silueta')
    assert medidas['alto_mm'] == 100.0
    assert 60 < medidas['ancho_mm'] < 65


def test_relieve_genera_pieza_cerrada():
    stl, medidas = generar_modelo(degradado(), 'relieve')
    triangulos = leer_stl(stl)
    assert es_cerrado(triangulos)
    assert volumen(triangulos) > 0
    assert medidas['ancho_mm'] == 100.0
    assert 4.4 < medidas['profundidad_mm'] <= 4.6


def test_imagen_lisa_da_error_claro():
    lisa = png(Image.new('RGB', (200, 200), 'white'))
    with pytest.raises(ErrorProcesamiento, match='No encontramos una figura'):
        generar_modelo(lisa, 'silueta')
    with pytest.raises(ErrorProcesamiento, match='un solo tono'):
        generar_modelo(lisa, 'relieve')


def test_archivo_que_no_es_imagen():
    with pytest.raises(ErrorProcesamiento, match='No pudimos leer la imagen'):
        generar_modelo(b'esto no es una imagen', 'silueta')


def test_endpoint_procesar():
    client = create_app().test_client()
    respuesta = client.post('/procesar', data={
        'estilo': 'relieve', 'imagen': (io.BytesIO(degradado()), 'foto.png'),
    }, content_type='multipart/form-data')
    assert respuesta.status_code == 200
    assert respuesta.mimetype == 'model/stl'
    assert respuesta.headers['X-ancho-mm'] == '100.0'

    error = client.post('/procesar', data={
        'estilo': 'silueta', 'imagen': (io.BytesIO(b'nada'), 'x.png'),
    }, content_type='multipart/form-data')
    assert error.status_code == 422
    assert 'error' in error.get_json()
