"""Pruebas aisladas: solo SQLite temporal y SMTP falso, sin red ni secretos.

Ejecutar desde servicio-usuarios:
python -m unittest discover -s tests -p test_correo_recuperacion_unittest.py -v
"""
import importlib.util
import io
import os
from pathlib import Path
import ssl
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch


SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))
IMPORT_DB = tempfile.TemporaryDirectory(prefix='cf-usuarios-import-test-')

# La importación de la app crea su base inicial; también debe ser temporal.
with patch.dict(os.environ, {
    'DATABASE_URL': 'sqlite:///' + (Path(IMPORT_DB.name) / 'import.db').as_posix(),
    'JWT_SECRET': 'clave-exclusiva-de-pruebas-no-usar-en-produccion',
}), patch('dotenv.load_dotenv', return_value=False) as cargar_env:
    spec = importlib.util.spec_from_file_location('usuarios_en_prueba', SERVICE_DIR / 'app.py')
    servicio = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(servicio)
    cargas_env = list(cargar_env.call_args_list)

import correo  # noqa: E402


SMTP_VACIO = {
    'SMTP_HOST': '', 'SMTP_PORT': '', 'SMTP_USER': '', 'SMTP_PASSWORD': '',
    'SMTP_APP_PASSWORD': '', 'SMTP_FROM': '',
}
SMTP_FALSO = {
    **SMTP_VACIO, 'SMTP_HOST': 'smtp.ejemplo.invalid', 'SMTP_PORT': '587',
    'SMTP_USER': 'tienda@ejemplo.invalid', 'SMTP_APP_PASSWORD': 'abcd efgh ijkl mnop',
}
DATOS = {
    'nombre': 'Persona', 'apellido': 'De Prueba', 'correo': 'persona@ejemplo.invalid',
    'rut': '12.345.678-5', 'telefono': '+56 9 1234 5678', 'contrasena': 'clave1234',
}


class SMTPFalso:
    conexiones = []

    def __init__(self, host, puerto, timeout, **kwargs):
        self.host, self.puerto, self.timeout = host, puerto, timeout
        self.contexto = kwargs.get('context')
        self.saludos = 0
        self.mensaje = None
        self.login_datos = None
        self.conexiones.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def ehlo(self):
        self.saludos += 1

    def starttls(self, *, context):
        self.contexto = context

    def login(self, usuario, clave):
        self.login_datos = (usuario, clave)

    def send_message(self, mensaje):
        self.mensaje = mensaje


class CorreoTests(unittest.TestCase):
    def setUp(self):
        SMTPFalso.conexiones = []

    def test_smtp_falso_tls_timeout_y_ambas_versiones_del_correo(self):
        with patch.dict(os.environ, SMTP_FALSO), patch('correo.smtplib.SMTP', SMTPFalso):
            estado = correo.enviar_enlace_recuperacion(
                'persona@ejemplo.invalid', '<Persona>', 'https://ejemplo.invalid/restablecer?token=solo-prueba&a=1',
            )
        self.assertEqual(estado, 'enviado')
        conexion = SMTPFalso.conexiones[0]
        self.assertEqual((conexion.host, conexion.puerto, conexion.timeout), ('smtp.ejemplo.invalid', 587, 8))
        self.assertEqual(conexion.login_datos, ('tienda@ejemplo.invalid', 'abcdefghijklmnop'))
        self.assertIsInstance(conexion.contexto, ssl.SSLContext)
        self.assertEqual(conexion.saludos, 2)
        self.assertIn('30 minutos', conexion.mensaje.get_body(preferencelist=('plain',)).get_content())
        html = conexion.mensaje.get_body(preferencelist=('html',)).get_content()
        self.assertIn('&lt;Persona&gt;', html)
        self.assertIn('&amp;a=1', html)
        self.assertIn('#a8ff27', html)

    def test_sin_configuracion_no_hay_conexion_ni_enlace_en_consola(self):
        salida = io.StringIO()
        with patch.dict(os.environ, SMTP_VACIO), patch('correo.smtplib.SMTP') as conexion, redirect_stdout(salida):
            estado = correo.enviar_enlace_recuperacion('persona@ejemplo.invalid', 'Persona', 'enlace-privado')
        self.assertEqual(estado, 'no_configurado')
        conexion.assert_not_called()
        self.assertEqual(salida.getvalue(), '')

    def test_error_smtp_sanitizado_y_precedencia_de_clave_nueva(self):
        with patch.dict(os.environ, {**SMTP_FALSO, 'SMTP_PASSWORD': 'clavepreferida'}):
            self.assertEqual(correo._clave_smtp(), 'clavepreferida')
            with patch('correo.smtplib.SMTP', side_effect=OSError('enlace-privado clavepreferida')):
                with self.assertLogs('correo', level='WARNING') as logs:
                    estado = correo.enviar_enlace_recuperacion('persona@ejemplo.invalid', 'Persona', 'enlace-privado')
        self.assertEqual(estado, 'error')
        self.assertNotIn('enlace-privado', ''.join(logs.output))
        self.assertNotIn('clavepreferida', ''.join(logs.output))


class RecuperacionTests(unittest.TestCase):
    def setUp(self):
        self.temporal = tempfile.TemporaryDirectory(prefix='cf-usuarios-test-')
        self.addCleanup(self.temporal.cleanup)
        self.variables = patch.dict(os.environ, {
            **SMTP_VACIO,
            'DATABASE_URL': 'sqlite:///' + (Path(self.temporal.name) / 'usuarios.db').as_posix(),
        })
        self.variables.start()
        self.addCleanup(self.variables.stop)
        self.client = servicio.create_app().test_client()
        respuesta = self.client.post('/registro', json=DATOS)
        self.assertEqual(respuesta.status_code, 201)

    def tearDown(self):
        # En Windows hay que cerrar SQLite antes de retirar la carpeta temporal.
        with self.client.application.app_context():
            servicio.db.session.remove()
            servicio.db.engine.dispose()

    def test_recuperacion_hash_expiracion_y_un_solo_uso_sin_filtrar_enlace(self):
        enviados = []
        with patch.object(servicio, 'correo_configurado', return_value=True), patch.object(
            servicio, 'enviar_enlace_recuperacion', side_effect=lambda *args: enviados.append(args),
        ), redirect_stdout(io.StringIO()) as salida:
            respuesta = self.client.post('/recuperar', json={'correo': DATOS['correo']})
        self.assertEqual(respuesta.status_code, 200)
        token = enviados[0][2].split('token=', 1)[1]
        self.assertNotIn(token, respuesta.get_data(as_text=True))
        self.assertNotIn(token, salida.getvalue())
        with self.client.application.app_context():
            guardado = servicio.TokenRecuperacion.query.one()
            self.assertEqual(guardado.token_hash, servicio.hash_token(token))
            self.assertNotEqual(guardado.token_hash, token)
            segundos = (guardado.fecha_expiracion - servicio.utc_now()).total_seconds()
            self.assertTrue(1790 < segundos <= 1800)
        datos = {'token': token, 'contrasena': 'nueva1234'}
        self.assertEqual(self.client.post('/restablecer', json=datos).status_code, 200)
        self.assertEqual(self.client.post('/restablecer', json=datos).status_code, 400)
        self.assertEqual(self.client.post('/login', json={'correo': DATOS['correo'], 'contrasena': 'nueva1234'}).status_code, 200)

    def test_no_configurado_no_enumera_cuentas_ni_promete_correo(self):
        with patch.object(servicio, 'enviar_enlace_recuperacion') as envio:
            existe = self.client.post('/recuperar', json={'correo': DATOS['correo']}).get_json()
            no_existe = self.client.post('/recuperar', json={'correo': 'noexiste@ejemplo.invalid'}).get_json()
        self.assertEqual(existe, no_existe)
        self.assertFalse(existe['correo_configurado'])
        self.assertIn('no está configurado', existe['mensaje'])
        envio.assert_not_called()
        with self.client.application.app_context():
            self.assertEqual(servicio.TokenRecuperacion.query.count(), 0)

    def test_fallo_de_envio_devuelve_json_generico_y_no_expone_enlace(self):
        with patch.object(servicio, 'correo_configurado', return_value=True), patch.object(
            servicio, 'enviar_enlace_recuperacion', side_effect=OSError('clave-y-enlace-privados'),
        ), self.assertLogs(self.client.application.logger.name, level='WARNING') as logs:
            respuesta = self.client.post('/recuperar', json={'correo': DATOS['correo']})
        no_existe = None
        with patch.object(servicio, 'correo_configurado', return_value=True):
            no_existe = self.client.post('/recuperar', json={'correo': 'noexiste@ejemplo.invalid'})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.get_json(), no_existe.get_json())
        self.assertNotIn('clave-y-enlace-privados', ''.join(logs.output))

    def test_instance_path_absoluto_y_token_malformado_no_crea_500(self):
        self.assertEqual(Path(self.client.application.instance_path), SERVICE_DIR / 'instance')
        self.assertEqual([llamada.args[0] for llamada in cargas_env],
                         [SERVICE_DIR.parent.parent / '.env', SERVICE_DIR / '.env'])
        self.assertTrue(all(llamada.kwargs['override'] is False for llamada in cargas_env))
        token = servicio.jwt.encode({'sub': 'no-es-numero'}, servicio.JWT_SECRET, algorithm='HS256')
        respuesta = self.client.get('/perfil', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(respuesta.status_code, 401)


if __name__ == '__main__':
    unittest.main()
