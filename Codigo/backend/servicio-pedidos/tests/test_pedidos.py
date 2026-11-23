from conftest import token
from io import BytesIO
from PIL import Image


def aprobar_pago(client, pedido_id):
    captura = BytesIO()
    Image.new('RGB', (20, 20), '#fff').save(captura, format='PNG')
    captura.seek(0)
    assert client.post(f'/pedidos/{pedido_id}/comprobante', headers=token(1),
                       data={'archivo': (captura, 'comprobante.png')}).status_code == 201
    assert client.patch(f'/pedidos/{pedido_id}/pago', json={'estado': 'aprobado'},
                        headers=token(9, 'administrador')).status_code == 200


# HU04.5 Confirmar compra
def test_confirmar_compra_requiere_sesion(client, compra):
    assert client.post('/pedidos', json=compra).status_code == 401


def test_valida_informacion_necesaria(client, compra):
    incompleta = {**compra, 'telefono_cliente': 'abc', 'metodo_entrega': 'blue', 'detalle_entrega': {}}
    respuesta = client.post('/pedidos', json=incompleta, headers=token(1))
    assert respuesta.status_code == 400
    assert set(respuesta.get_json()['campos']) == {'telefono_cliente', 'region', 'comuna', 'direccion'}
    assert client.post('/pedidos', json={**compra, 'items': []}, headers=token(1)).status_code == 400


def test_registra_el_pedido_con_precios_reales(client, compra):
    # El navegador manda un precio falso: se ignora
    compra['items'][0]['precio'] = 1
    respuesta = client.post('/pedidos', json=compra, headers=token(1))
    pedido = respuesta.get_json()
    assert respuesta.status_code == 201
    assert pedido['total'] == 2 * 3990 + 14990
    assert pedido['estado'] == 'pendiente'
    assert pedido['historial'][0]['estado'] == 'pendiente'


def test_rechaza_producto_o_diseno_inexistente(client, compra):
    sin_producto = {**compra, 'items': [{'id_producto': 999, 'cantidad': 1}]}
    assert 'ya no está disponible' in client.post('/pedidos', json=sin_producto, headers=token(1)).get_json()['error']
    sin_diseno = {**compra, 'items': [{'codigo_solicitud': 'b' * 32}]}
    assert 'no está confirmado' in client.post('/pedidos', json=sin_diseno, headers=token(1)).get_json()['error']


# HU05.1 Historial · HU05.2 Detalle · HU05.3 Estado
def test_historial_solo_muestra_pedidos_propios(client, compra):
    client.post('/pedidos', json=compra, headers=token(1))
    client.post('/pedidos', json=compra, headers=token(2))
    propios = client.get('/pedidos', headers=token(1)).get_json()
    assert len(propios) == 1
    assert {'id', 'fecha', 'estado', 'total'} <= set(propios[0])
    # Aunque pida "todos", un cliente solo ve los suyos
    assert len(client.get('/pedidos?todos=true', headers=token(1)).get_json()) == 1


def test_detalle_muestra_productos_personalizacion_y_estado(client, compra):
    pedido_id = client.post('/pedidos', json=compra, headers=token(1)).get_json()['id']
    detalle = client.get(f'/pedidos/{pedido_id}', headers=token(1)).get_json()
    assert detalle['estado'] == 'pendiente'
    diseno = next(item for item in detalle['items'] if item['tipo'] == 'personalizado')
    assert diseno['detalle'] == 'Silueta · Morado · Grande (15 cm)'
    # Otro cliente no puede verlo
    assert client.get(f'/pedidos/{pedido_id}', headers=token(2)).status_code == 404


# HU05.4 Actualizar estado · HU05.5 Pedidos recibidos
def test_admin_actualiza_estado_y_el_cliente_lo_ve(client, compra):
    pedido_id = client.post('/pedidos', json=compra, headers=token(1)).get_json()['id']
    assert client.patch(f'/pedidos/{pedido_id}/estado', json={'estado': 'confirmado'}, headers=token(1)).status_code == 403
    assert client.patch(f'/pedidos/{pedido_id}/estado', json={'estado': 'inventado'}, headers=token(9, 'administrador')).status_code == 400
    aprobar_pago(client, pedido_id)

    respuesta = client.patch(f'/pedidos/{pedido_id}/estado', json={'estado': 'en_produccion', 'comentario': 'Imprimiendo'},
                             headers=token(9, 'administrador'))
    assert respuesta.status_code == 200
    visto = client.get(f'/pedidos/{pedido_id}', headers=token(1)).get_json()
    assert visto['estado'] == 'en_produccion'
    assert [h['estado'] for h in visto['historial']] == ['pendiente', 'pendiente', 'confirmado', 'en_produccion']
    assert visto['historial'][-1]['comentario'] == 'Imprimiendo'


def test_admin_ve_todos_los_pedidos_y_filtra(client, compra):
    primero = client.post('/pedidos', json=compra, headers=token(1)).get_json()['id']
    client.post('/pedidos', json={**compra, 'nombre_cliente': 'Camila Zúñiga'}, headers=token(2))
    admin = token(9, 'administrador')
    aprobar_pago(client, primero)
    client.patch(f'/pedidos/{primero}/estado', json={'estado': 'enviado'}, headers=admin)

    assert len(client.get('/pedidos?todos=true', headers=admin).get_json()) == 2
    assert [p['id'] for p in client.get('/pedidos?todos=true&estado=enviado', headers=admin).get_json()] == [primero]
    assert client.get('/pedidos?todos=true&q=camila', headers=admin).get_json()[0]['cliente'] == 'Camila Zúñiga'
    assert client.get(f'/pedidos?todos=true&q=%23{primero}', headers=admin).get_json()[0]['id'] == primero


# Dashboard
def test_estadisticas(client, compra):
    admin = token(9, 'administrador')
    assert client.get('/estadisticas', headers=token(1)).status_code == 403
    client.post('/pedidos', json=compra, headers=token(1))
    cancelado = client.post('/pedidos', json=compra, headers=token(1)).get_json()['id']
    client.patch(f'/pedidos/{cancelado}/estado', json={'estado': 'cancelado'}, headers=admin)

    datos = client.get('/estadisticas', headers=admin).get_json()
    assert len(datos['por_mes']) == 6
    assert datos['mes_actual']['pedidos'] == 1  # el cancelado no cuenta
    assert datos['mes_actual']['ventas'] == 2 * 3990 + 14990
    assert datos['ticket_promedio'] == 2 * 3990 + 14990
    assert [c['nombre'] for c in datos['por_categoria']] == ['Diseño personalizado', 'Llaveros']
    assert datos['por_estado'] == {'pendiente': 1, 'cancelado': 1}
    assert datos['comparacion']['actual'] == {'pedidos': 1, 'ventas': 2 * 3990 + 14990}
    assert datos['comparacion']['anterior'] == {'pedidos': 0, 'ventas': 0}


# HU06.4 y HU06.5: pedidos de un cliente y pedidos de una solicitud
def test_admin_filtra_por_cliente_y_por_solicitud(client, compra):
    admin = token(9, 'administrador')
    primero = client.post('/pedidos', json=compra, headers=token(1)).get_json()['id']
    client.post('/pedidos', json={**compra, 'items': [{'id_producto': 8}], 'total_aceptado': 12990}, headers=token(2))

    del_cliente = client.get('/pedidos?todos=true&usuario=1', headers=admin).get_json()
    assert [p['id'] for p in del_cliente] == [primero] and del_cliente[0]['id_usuario'] == 1
    assert [p['id'] for p in client.get(f'/pedidos/por-solicitud/{"a" * 32}', headers=admin).get_json()] == [primero]
    assert client.get(f'/pedidos/por-solicitud/{"a" * 32}', headers=token(1)).status_code == 403
