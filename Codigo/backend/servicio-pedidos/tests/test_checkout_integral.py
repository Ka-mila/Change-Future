"""Pruebas aisladas del checkout: nunca usan las bases ni el SMTP del negocio.

Ejecutar desde servicio-pedidos: python -B -m unittest discover -s tests -p test_checkout_integral.py -v
"""
from io import BytesIO
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid

import jwt
from PIL import Image
from werkzeug.datastructures import FileStorage

TEMP_IMPORT = tempfile.TemporaryDirectory()
os.environ['CF_TESTING'] = '1'
os.environ['DATABASE_URL'] = f'sqlite:///{TEMP_IMPORT.name}/import.db'
os.environ['UPLOAD_COMPROBANTES_DIR'] = f'{TEMP_IMPORT.name}/comprobantes'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app as servicio  # noqa: E402
from checkout import calcular_envio, transferencia_config  # noqa: E402
from correo import construir_mensaje, enviar_notificaciones  # noqa: E402
from comprobantes import imagen_validada  # noqa: E402


def token(usuario=1, rol='cliente'):
    firmado = jwt.encode({'sub': str(usuario), 'rol': rol}, servicio.JWT_SECRET, algorithm='HS256')
    return {'Authorization': 'Bearer ' + firmado}


def imagen(formato='PNG'):
    salida = BytesIO()
    Image.new('RGB', (32, 24), '#abed31').save(salida, format=formato)
    return salida.getvalue()


class CheckoutTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.app = servicio.create_app({'TESTING': True,
            'SQLALCHEMY_DATABASE_URI': f'sqlite:///{self.temp.name}/pedidos.db',
            'COMPROBANTES_DIR': f'{self.temp.name}/comprobantes'})
        self.apps = [self.app]
        self.addCleanup(self.cerrar_bases)
        self.client = self.app.test_client()
        for objetivo, reemplazo in (
            ('fetch_producto', lambda pid: {'id': pid, 'nombre': 'Llavero', 'categoria': 'Llaveros', 'precio': 3990} if pid == 6 else None),
            ('fetch_diseno', lambda codigo: {'codigo': codigo, 'nombre': 'Diseño propio', 'detalle': 'Silueta · Morado · Grande (15 cm)', 'precio': 14990} if codigo == 'a' * 32 else None),
            ('fetch_perfil', lambda: {'correo': f"cliente{servicio.token_payload()['sub']}@example.test"}),
        ):
            mock = patch.object(servicio, objetivo, reemplazo)
            mock.start()
            self.addCleanup(mock.stop)
        self.notificador = patch.object(servicio, 'enviar_notificaciones', return_value={'negocio': 'enviado', 'cliente': 'enviado'}).start()
        self.addCleanup(patch.stopall)
        self.datos = {'nombre_cliente': 'Cliente prueba', 'telefono_cliente': '+56 9 1234 5678',
                      'metodo_entrega': 'metro', 'detalle_entrega': {'estacion': 'Rojas Magallanes'},
                      'metodo_pago': 'transferencia', 'items': [{'id_producto': 6, 'cantidad': 1}]}

    def cerrar_bases(self):
        for app in self.apps:
            with app.app_context():
                servicio.db.session.remove()
                servicio.db.engine.dispose()

    def crear(self, cambios=None, usuario=1, rol='cliente'):
        datos = self.datos | (cambios or {})
        cotizacion = self.client.post('/cotizar', json=datos).get_json()
        datos['total_aceptado'] = cotizacion['total']
        respuesta = self.client.post('/pedidos', json=datos, headers=token(usuario, rol))
        self.assertEqual(respuesta.status_code, 201, respuesta.get_json())
        return respuesta.get_json()

    def subir(self, pedido_id, usuario=1, contenido=None):
        return self.client.post(f'/pedidos/{pedido_id}/comprobante', headers=token(usuario),
            data={'archivo': (BytesIO(contenido if contenido is not None else imagen()), 'captura.png'),
                  'referencia_transferencia': 'PRUEBA-123'}, content_type='multipart/form-data')

    def aprobar(self, pedido_id):
        self.assertEqual(self.subir(pedido_id).status_code, 201)
        respuesta = self.client.patch(f'/pedidos/{pedido_id}/pago', json={'estado': 'aprobado', 'observacion': 'Verificada'},
                                      headers=token(9, 'administrador'))
        self.assertEqual(respuesta.status_code, 200, respuesta.get_json())
        return respuesta.get_json()

    def test_opciones_regiones_banco_y_simulacion(self):
        opciones = self.client.get('/checkout/opciones').get_json()
        self.assertEqual(len(opciones['regiones']), 16)
        self.assertTrue(opciones['envio']['simulado'])
        self.assertIn('no son tarifas oficiales', opciones['envio']['nota'])
        self.assertEqual(opciones['transferencia']['numero_cuenta'], '1026449772')
        self.assertTrue(opciones['transferencia']['configurada'])
        with patch.dict(os.environ, {'TRANSFERENCIA_NUMERO_CUENTA': ''}):
            self.assertFalse(transferencia_config()['configurada'])

    def test_cotizacion_envio_regiones_y_limites_talla(self):
        for unidades, talla in ((1, 'S'), (3, 'S'), (4, 'M'), (8, 'M'), (9, 'L')):
            envio = calcular_envio('blue', {'region': 'metropolitana', 'comuna': 'La Florida'}, unidades)
            self.assertEqual(envio['talla'], talla)
            self.assertTrue(envio['simulado'])
        urbano = calcular_envio('blue', {'region': 'metropolitana', 'comuna': 'La Florida'}, 1)
        alejado = calcular_envio('blue', {'region': 'metropolitana', 'comuna': 'Melipilla'}, 1)
        self.assertEqual(urbano['costo'], 3500)
        self.assertGreater(alejado['costo'], urbano['costo'])
        self.assertEqual(calcular_envio('metro', {}, 99)['costo'], 0)
        for region in self.client.get('/checkout/opciones').get_json()['regiones']:
            self.assertGreater(calcular_envio('blue', {'region': region['codigo'], 'comuna': 'Comuna prueba'}, 1)['costo'], 0)

    def test_valida_destino_y_cantidades_sin_crear_pedidos(self):
        datos = self.datos | {'metodo_entrega': 'blue', 'detalle_entrega': {}}
        respuesta = self.client.post('/cotizar', json=datos)
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(set(respuesta.get_json()['campos']), {'region', 'comuna'})
        for cantidad in (0, 100, 1.5, True):
            respuesta = self.client.post('/cotizar', json=self.datos | {'items': [{'id_producto': 6, 'cantidad': cantidad}]})
            self.assertEqual(respuesta.status_code, 400)

    def test_cambio_total_requiere_aceptacion_y_correo_es_de_perfil(self):
        datos = self.datos | {'total_aceptado': 1, 'correo': 'atacante@example.test'}
        self.assertEqual(self.client.post('/pedidos', json=datos).status_code, 401)
        respuesta = self.client.post('/pedidos', json=datos, headers=token())
        self.assertEqual(respuesta.status_code, 409)
        self.assertEqual(respuesta.get_json()['cotizacion']['total'], 3990)
        self.assertEqual(self.client.get('/pedidos', headers=token()).get_json(), [])
        pedido = self.crear({'correo': 'atacante@example.test'})
        self.assertEqual(pedido['correo'], 'cliente1@example.test')
        self.assertEqual(pedido['pago']['estado'], 'pendiente')
        self.assertEqual(pedido['estado'], 'pendiente')

    def test_personalizado_y_envio_se_guardan_con_precios_reales(self):
        pedido = self.crear({'metodo_entrega': 'blue',
            'detalle_entrega': {'region': 'metropolitana', 'comuna': 'La Florida', 'direccion': 'Calle prueba 123'},
            'items': [{'id_producto': 6, 'cantidad': 1, 'precio': 1}, {'codigo_solicitud': 'a' * 32, 'cantidad': 1}]})
        self.assertEqual(pedido['subtotal'], 3990 + 14990)
        self.assertEqual(pedido['total'], pedido['subtotal'] + 3500)
        self.assertEqual(pedido['envio']['talla'], 'S')
        self.assertTrue(pedido['envio']['simulado'])
        self.assertIn('Morado', pedido['items'][1]['detalle'])
        self.assertEqual(pedido['detalle_entrega']['region'], 'metropolitana')

    def test_idempotencia_reintento_no_duplica_ni_reenvia_correo(self):
        clave = str(uuid.uuid4())
        primero = self.crear({'clave_idempotencia': clave})
        datos = self.datos | {'clave_idempotencia': clave, 'total_aceptado': 3990}
        respuesta = self.client.post('/pedidos', json=datos, headers=token())
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.get_json()['id'], primero['id'])
        self.assertEqual(len(self.client.get('/pedidos', headers=token()).get_json()), 1)
        self.assertEqual(self.notificador.call_count, 1)
        otro = self.crear({'clave_idempotencia': clave}, usuario=2)
        self.assertNotEqual(otro['id'], primero['id'])

    def test_archivo_invalido_y_acceso_ajeno_no_guardan_comprobante(self):
        pedido = self.crear()
        self.assertEqual(self.subir(pedido['id'], usuario=2).status_code, 404)
        self.assertEqual(self.subir(pedido['id'], contenido=b'no es una imagen').status_code, 400)
        with closing(FileStorage(stream=BytesIO(b'x' * (5 * 1024 * 1024 + 1)), filename='grande.png')) as archivo:
            with self.assertRaisesRegex(ValueError, 'máximo 5 MB'):
                imagen_validada(archivo)
        self.assertEqual(self.client.get(f"/pedidos/{pedido['id']}", headers=token()).get_json()['pago']['comprobantes'], [])

    def test_comprobante_privado_queda_en_revision_no_pagado(self):
        pedido = self.crear()
        respuesta = self.subir(pedido['id'])
        self.assertEqual(respuesta.status_code, 201)
        actualizado = respuesta.get_json()
        self.assertEqual(actualizado['estado'], 'pendiente')
        self.assertEqual(actualizado['pago']['estado'], 'en_revision')
        cid = actualizado['pago']['comprobantes'][0]['id']
        ruta = f"/pedidos/{pedido['id']}/comprobantes/{cid}"
        self.assertEqual(self.client.get(ruta).status_code, 401)
        self.assertEqual(self.client.get(ruta, headers=token(2)).status_code, 404)
        for headers in (token(), token(9, 'administrador')):
            archivo = self.client.get(ruta, headers=headers)
            self.assertEqual(archivo.status_code, 200)
            self.assertIn('no-store', archivo.headers['Cache-Control'])
            self.assertEqual(archivo.headers['X-Content-Type-Options'], 'nosniff')
            self.assertEqual(archivo.mimetype, 'image/png')
            archivo.close()
        self.assertEqual(self.subir(pedido['id']).status_code, 409)

    def test_solo_admin_aprueba_y_pedido_avanza_con_historial(self):
        pedido = self.crear()
        ruta = f"/pedidos/{pedido['id']}/pago"
        self.assertEqual(self.client.patch(ruta, json={'estado': 'aprobado'}, headers=token()).status_code, 403)
        self.assertEqual(self.client.patch(ruta, json={'estado': 'aprobado'}, headers=token(9, 'administrador')).status_code, 409)
        actualizado = self.aprobar(pedido['id'])
        self.assertEqual(actualizado['pago']['estado'], 'aprobado')
        self.assertEqual(actualizado['estado'], 'confirmado')
        self.assertEqual(actualizado['historial'][-1]['estado'], 'confirmado')
        self.assertEqual(actualizado['pago']['comprobantes'][0]['estado'], 'aprobado')
        self.assertEqual(self.subir(pedido['id']).status_code, 409)

    def test_rechazo_permite_nueva_captura_y_conserva_anterior(self):
        pedido = self.crear()
        self.subir(pedido['id'])
        rechazo = self.client.patch(f"/pedidos/{pedido['id']}/pago", json={'estado': 'rechazado', 'observacion': 'Monto incompleto'},
                                    headers=token(9, 'administrador'))
        self.assertEqual(rechazo.get_json()['pago']['estado'], 'rechazado')
        nueva = self.subir(pedido['id']).get_json()
        self.assertEqual([c['estado'] for c in nueva['pago']['comprobantes']], ['rechazado', 'en_revision'])
        self.assertEqual(nueva['estado'], 'pendiente')

    def test_estado_y_seguimiento_requieren_revision_pago(self):
        pedido = self.crear()
        ruta = f"/pedidos/{pedido['id']}/estado"
        self.assertEqual(self.client.patch(ruta, json={'estado': 'en_produccion'}, headers=token(9, 'administrador')).status_code, 409)
        self.aprobar(pedido['id'])
        respuesta = self.client.patch(ruta, json={'estado': 'enviado', 'codigo_seguimiento': 'BX-DEMO-123', 'comentario': 'Despachado'},
                                      headers=token(9, 'administrador'))
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.get_json()['codigo_seguimiento'], 'BX-DEMO-123')
        self.assertEqual(respuesta.get_json()['historial'][-1]['estado'], 'enviado')

    def test_cancelado_no_acepta_captura(self):
        pedido = self.crear()
        self.client.patch(f"/pedidos/{pedido['id']}/estado", json={'estado': 'cancelado'}, headers=token(9, 'administrador'))
        self.assertEqual(self.subir(pedido['id']).status_code, 409)

    def test_revision_simultanea_tiene_una_unica_decision(self):
        pedido = self.crear()
        self.subir(pedido['id'])
        def revisar(estado):
            with self.app.test_client() as client:
                return client.patch(f"/pedidos/{pedido['id']}/pago", json={'estado': estado},
                                    headers=token(9, 'administrador')).status_code
        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            codigos = list(ejecutor.map(revisar, ('aprobado', 'rechazado')))
        self.assertEqual(sorted(codigos), [200, 409])
        actual = self.client.get(f"/pedidos/{pedido['id']}", headers=token()).get_json()
        self.assertIn(actual['pago']['estado'], ('aprobado', 'rechazado'))
        self.assertEqual(actual['pago']['comprobantes'][0]['estado'], actual['pago']['estado'])
        self.assertEqual(self.notificador.call_count, 3)  # pedido, captura, una decisión

    def test_perfil_no_verificable_no_crea_pedido(self):
        with patch.object(servicio, 'fetch_perfil', return_value=None):
            respuesta = self.client.post('/pedidos', json=self.datos | {'total_aceptado': 3990}, headers=token())
        self.assertEqual(respuesta.status_code, 401)
        self.assertEqual(self.client.get('/pedidos', headers=token()).get_json(), [])

    def test_error_smtp_no_revierte_pedido_ni_compra(self):
        self.notificador.side_effect = RuntimeError('SMTP fuera de servicio')
        pedido = self.crear()
        self.assertEqual(pedido['notificaciones'], {'negocio': 'error', 'cliente': 'error'})
        self.assertEqual(self.client.get(f"/pedidos/{pedido['id']}", headers=token()).status_code, 200)

    def test_emails_separados_html_y_texto_con_transporte_falso(self):
        pedido = self.crear()
        enviados = []

        class SMTPFalso:
            def __init__(self, *args, **kwargs):
                self.timeout = kwargs['timeout']
            def __enter__(self):
                return self
            def __exit__(self, *args):
                return False
            def starttls(self, **kwargs):
                pass
            def login(self, usuario, clave):
                pass
            def send_message(self, mensaje):
                enviados.append(mensaje)

        with self.app.app_context(), patch.dict(os.environ, {'SMTP_USER': 'negocio@example.test', 'SMTP_PASSWORD': 'clave-ficticia',
                'CF_ADMIN_EMAIL': 'admin@example.test', 'SMTP_PORT': '587'}), patch('correo.smtplib.SMTP', SMTPFalso):
            entidad = servicio.db.session.get(servicio.Pedido, pedido['id'])
            resultado = enviar_notificaciones(entidad, 'pedido_registrado')
        self.assertEqual(resultado, {'negocio': 'enviado', 'cliente': 'enviado'})
        self.assertEqual([m['To'] for m in enviados], ['admin@example.test', 'cliente1@example.test'])
        for mensaje in enviados:
            self.assertEqual(mensaje.get_body(preferencelist=('plain',)).get_content_type(), 'text/plain')
            self.assertIn('Change', mensaje.get_body(preferencelist=('html',)).get_content())

    def test_migracion_aditiva_conserva_total_y_pedidos_anteriores(self):
        ruta = str(Path(self.temp.name) / 'antigua.db')
        with sqlite3.connect(ruta) as conexion:
            conexion.executescript('''CREATE TABLE estado_pedido (id_estado_pedido INTEGER PRIMARY KEY,
                nombre_estado VARCHAR(40) UNIQUE NOT NULL, descripcion VARCHAR(200), orden INTEGER);
                INSERT INTO estado_pedido VALUES (1, 'pendiente', 'Anterior', 0);
                CREATE TABLE pedido (id_pedido INTEGER PRIMARY KEY, id_usuario INTEGER,
                id_estado_pedido INTEGER NOT NULL, fecha_pedido DATETIME, nombre_cliente VARCHAR(120) NOT NULL,
                telefono_cliente VARCHAR(30) NOT NULL, metodo_entrega VARCHAR(20) NOT NULL,
                detalle_entrega JSON, total INTEGER NOT NULL, observacion TEXT);
                INSERT INTO pedido VALUES (40, 1, 1, '2026-11-01 10:00:00', 'Cuenta previa', '+56912345678',
                'metro', '{}', 12345, 'Conservar');''')
        conexion.close()
        app = servicio.create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': f'sqlite:///{ruta}',
                                   'COMPROBANTES_DIR': f'{self.temp.name}/migracion-comprobantes'})
        self.apps.append(app)
        client = app.test_client()
        anterior = client.get('/pedidos/40', headers=token()).get_json()
        self.assertEqual(anterior['total'], 12345)
        self.assertEqual(anterior['subtotal'], 12345)
        self.assertEqual(anterior['observacion'], 'Conservar')
        self.assertEqual(anterior['pago']['metodo'], 'coordinado')
        self.assertEqual(client.patch('/pedidos/40/estado', json={'estado': 'en_produccion'},
                                     headers=token(9, 'administrador')).status_code, 200)


if __name__ == '__main__':
    unittest.main()
