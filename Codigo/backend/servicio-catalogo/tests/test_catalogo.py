import io

from conftest import PNG, token


# HU06.1 Agregar producto
def test_solo_admin_crea_productos(client, nuevo):
    assert client.post('/productos', data=nuevo, headers=token('cliente')).status_code == 403


def test_valida_informacion_requerida(client, admin):
    respuesta = client.post('/productos', data={'precio': '-3'}, headers=admin)
    assert respuesta.status_code == 400
    assert set(respuesta.get_json()['campos']) == {'nombre', 'descripcion', 'categoria', 'precio'}


def test_crea_producto_con_imagen_y_aparece_en_catalogo(client, admin, nuevo):
    respuesta = client.post('/productos', data={**nuevo, 'imagen': (io.BytesIO(PNG), 'luna.png')},
                            headers=admin, content_type='multipart/form-data')
    producto = respuesta.get_json()
    assert respuesta.status_code == 201
    assert producto['precio'] == 15990
    assert producto['imagen'].startswith('/api/catalogo/imagenes/')
    assert client.get(producto['imagen'].replace('/api/catalogo', '')).data == PNG

    catalogo = client.get('/productos?q=luna').get_json()
    assert [p['nombre'] for p in catalogo] == ['Lámpara luna']


def test_rechaza_imagen_no_permitida(client, admin, nuevo):
    respuesta = client.post('/productos', data={**nuevo, 'imagen': (io.BytesIO(b'%PDF'), 'doc.pdf')},
                            headers=admin, content_type='multipart/form-data')
    assert respuesta.status_code == 400
    assert 'Formato no permitido' in respuesta.get_json()['campos']['imagen']


def test_categoria_nueva_se_crea(client, admin, nuevo):
    client.post('/productos', data={**nuevo, 'categoria': 'Lámparas'}, headers=admin)
    assert 'Lámparas' in [c['nombre'] for c in client.get('/categorias').get_json()]


# HU06.2 Modificar producto
def test_modifica_y_se_refleja_en_catalogo(client, admin):
    respuesta = client.put('/productos/6', data={'precio': '4990', 'nombre': 'Llavero con nombre'}, headers=admin)
    assert respuesta.status_code == 200
    publico = client.get('/productos/6').get_json()
    assert (publico['nombre'], publico['precio'], publico['categoria']) == ('Llavero con nombre', 4990, 'Llaveros')
    assert client.put('/productos/6', data={'precio': 'gratis'}, headers=admin).status_code == 400
    assert client.put('/productos/6', data={'precio': '1'}, headers=token('cliente')).status_code == 403


# HU06.3 Deshabilitar producto
def test_deshabilitado_no_esta_disponible(client, admin):
    respuesta = client.patch('/productos/6/estado', json={'activo': False}, headers=admin)
    assert respuesta.get_json()['activo'] is False
    assert client.get('/productos/6').status_code == 404  # el pedido usa esta ruta: no se puede comprar
    assert 6 not in [p['id'] for p in client.get('/productos').get_json()]
    assert 'Llaveros' not in [c['nombre'] for c in client.get('/categorias').get_json()]

    # El administrador lo sigue viendo y puede reactivarlo: la información no se pierde
    todos = client.get('/productos?incluir_inactivos=true', headers=admin).get_json()
    assert next(p for p in todos if p['id'] == 6)['nombre'] == 'Llavero personalizado'
    assert len(client.get('/productos?incluir_inactivos=true').get_json()) == 7  # sin sesión no
    client.patch('/productos/6/estado', json={'activo': True}, headers=admin)
    assert client.get('/productos/6').status_code == 200
