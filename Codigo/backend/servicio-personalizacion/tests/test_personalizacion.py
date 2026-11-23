import os

from conftest import ConnectionError, RespuestaFalsa

import app as servicio


def test_opciones_muestra_colores_y_tamanos(client):
    data = client.get('/opciones').get_json()
    assert len(data['colores']) == 8 and data['colores'][0]['hex'].startswith('#')
    assert [t['nombre'] for t in data['tamanos']] == ['Pequeño', 'Mediano', 'Grande']
    assert {e['id'] for e in data['estilos']} == {'silueta', 'relieve'}


# Cargar imagen
def test_solo_acepta_formatos_permitidos(subir):
    for datos, nombre in [(b'GIF89a...', 'idea.gif'), (b'%PDF-1.4', 'idea.pdf'), (b'no es png', 'falsa.png')]:
        respuesta = subir(datos, nombre)
        assert respuesta.status_code == 400
        assert 'Formato no permitido' in respuesta.get_json()['error']


def test_informa_imagen_muy_pesada(subir):
    respuesta = subir(b'\x89PNG' + b'0' * (11 * 1024 * 1024))
    assert respuesta.status_code in (400, 413)
    assert 'pesa más de 10 MB' in respuesta.get_json()['error']


def test_imagen_queda_asociada_a_la_solicitud(client, subir):
    data = subir().get_json()
    with client.application.app_context():
        solicitud = servicio.SolicitudPersonalizacion.query.filter_by(codigo=data['codigo']).first()
        assert solicitud.imagen_referencia == f'{data["codigo"]}.png'
        assert os.path.exists(os.path.join(servicio.REFERENCIAS_DIR, solicitud.imagen_referencia))


# Generar propuesta
def test_envia_imagen_al_procesamiento_y_recibe_propuesta(client, subir, procesamiento):
    respuesta = subir(estilo='relieve')
    data = respuesta.get_json()
    assert respuesta.status_code == 201
    assert procesamiento.llamadas[0]['data'] == {'estilo': 'relieve'}
    assert data['propuesta']['estilo'] == 'relieve'
    assert data['propuesta']['alto_mm'] == 70.0
    assert client.get(f'/solicitudes/{data["codigo"]}/modelo').data == b'solid'


def test_informa_error_del_procesamiento(client, subir, procesamiento):
    procesamiento.respuesta = RespuestaFalsa(422, json={'error': 'No encontramos una figura en la imagen.'})
    respuesta = subir()
    assert respuesta.status_code == 422
    assert respuesta.get_json()['error'] == 'No encontramos una figura en la imagen.'
    codigo = respuesta.get_json()['codigo']

    # Se puede reintentar con otro estilo sin volver a subir la imagen
    procesamiento.respuesta = RespuestaFalsa(headers={'X-ancho-mm': '100'})
    otra = client.post(f'/solicitudes/{codigo}/propuestas', json={'estilo': 'relieve'})
    assert otra.status_code == 201
    assert otra.get_json()['propuesta']['estilo'] == 'relieve'


def test_informa_si_el_procesamiento_esta_apagado(subir, procesamiento):
    procesamiento.respuesta = ConnectionError()
    respuesta = subir()
    assert respuesta.status_code == 503
    assert 'no está disponible' in respuesta.get_json()['error']


# Seleccionar color y tamaño + visualizar y confirmar
def test_seleccion_de_color_y_tamano_y_confirmacion(client, subir):
    codigo = subir().get_json()['codigo']

    sin_elegir = client.post(f'/solicitudes/{codigo}/confirmar')
    assert sin_elegir.status_code == 400
    assert 'el color' in sin_elegir.get_json()['error']

    assert client.patch(f'/solicitudes/{codigo}', json={'id_color': 999}).status_code == 400
    data = client.patch(f'/solicitudes/{codigo}', json={'id_color': 4, 'id_tamano': 2}).get_json()
    assert data['color']['nombre'] == 'Morado'
    assert data['tamano']['medida_mm'] == 100
    assert data['precio'] == 9990
    assert data['detalle_item'] == 'Silueta · Morado · Mediano (10 cm)'

    confirmada = client.post(f'/solicitudes/{codigo}/confirmar').get_json()
    assert confirmada['estado'] == 'confirmada'
    assert confirmada['propuesta']['estado_aprobacion'] == 'aprobada'

    # Una vez confirmada no se puede cambiar
    assert client.patch(f'/solicitudes/{codigo}', json={'id_color': 1}).status_code == 409

    resumen = client.get(f'/solicitudes/{codigo}/resumen').get_json()
    assert resumen == {'codigo': codigo, 'nombre': 'Diseño personalizado: Decoración',
                       'detalle': 'Silueta · Morado · Mediano (10 cm)', 'precio': 9990}


def test_resumen_solo_para_confirmadas(client, subir):
    codigo = subir().get_json()['codigo']
    assert client.get(f'/solicitudes/{codigo}/resumen').status_code == 404
    assert client.get('/solicitudes/no-existe').status_code == 404


# HU06.5 Gestionar solicitudes de personalización
def test_admin_gestiona_solicitudes(client, subir):
    import jwt
    admin = {'Authorization': 'Bearer ' + jwt.encode({'sub': '9', 'rol': 'administrador'}, servicio.JWT_SECRET, algorithm='HS256')}
    cliente = {'Authorization': 'Bearer ' + jwt.encode({'sub': '1', 'rol': 'cliente'}, servicio.JWT_SECRET, algorithm='HS256')}

    borrador = subir().get_json()['codigo']
    codigo = client.post('/solicitudes', headers=cliente, content_type='multipart/form-data', data={
        'tipo': 'Regalo personalizado', 'estilo': 'relieve', 'imagen': (__import__('io').BytesIO(b'\x89PNG0000'), 'a.png')}).get_json()['codigo']
    client.patch(f'/solicitudes/{codigo}', json={'id_color': 2, 'id_tamano': 3})
    client.post(f'/solicitudes/{codigo}/confirmar')

    assert client.get('/solicitudes', headers=cliente).get_json()[0]['codigo'] == codigo  # el cliente ve las suyas
    lista = client.get('/solicitudes', headers=admin).get_json()
    assert [s['codigo'] for s in lista] == [codigo]  # sin borradores
    s = lista[0]
    assert (s['id_usuario'], s['estilo'], s['color']['nombre'], s['tamano']['nombre']) == (1, 'relieve', 'Blanco', 'Grande')
    assert s['imagen_referencia'] == f'{codigo}.png'
    assert client.get(f'/referencias/{s["imagen_referencia"]}', headers=admin).status_code == 200
    assert client.get(f'/referencias/{s["imagen_referencia"]}', headers=cliente).status_code == 403
    assert [x['codigo'] for x in client.get('/solicitudes?estado=borrador', headers=admin).get_json()] == [borrador]

    assert client.patch(f'/solicitudes/{codigo}/estado', json={'estado': 'en_revision'}, headers=cliente).status_code == 403
    assert client.patch(f'/solicitudes/{codigo}/estado', json={'estado': 'inventado'}, headers=admin).status_code == 400
    assert client.patch(f'/solicitudes/{borrador}/estado', json={'estado': 'aprobada'}, headers=admin).status_code == 400
    actualizada = client.patch(f'/solicitudes/{codigo}/estado', headers=admin,
                               json={'estado': 'rechazada', 'observaciones': 'La foto está muy oscura'}).get_json()
    assert (actualizada['estado'], actualizada['observaciones']) == ('rechazada', 'La foto está muy oscura')
    assert actualizada['propuesta']['estado_aprobacion'] == 'rechazada'
    assert client.get(f'/solicitudes/{codigo}/resumen').status_code == 404  # rechazada: ya no se puede comprar
    client.patch(f'/solicitudes/{codigo}/estado', headers=admin, json={'estado': 'en_revision'})
    assert client.get(f'/solicitudes/{codigo}/resumen').status_code == 200  # en revisión: sí
    assert [x['codigo'] for x in client.get('/solicitudes?estado=en_revision', headers=admin).get_json()] == [codigo]
