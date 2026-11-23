import os
import sys
import tempfile

import jwt
import pytest

_dir = tempfile.mkdtemp()
os.environ['CF_TESTING'] = '1'
os.environ['DATABASE_URL'] = f'sqlite:///{_dir}/import.db'
os.environ['UPLOAD_COMPROBANTES_DIR'] = f'{_dir}/comprobantes-import'
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app as servicio  # noqa: E402

PRODUCTOS = {
    6: {'id': 6, 'nombre': 'Llavero personalizado', 'categoria': 'Llaveros', 'precio': 3990},
    8: {'id': 8, 'nombre': 'Organizador de escritorio', 'categoria': 'Organizadores', 'precio': 12990},
}
DISENO = {'codigo': 'a' * 32, 'nombre': 'Diseño personalizado: Decoración',
          'detalle': 'Silueta · Morado · Grande (15 cm)', 'precio': 14990}


def token(usuario_id, rol='cliente'):
    clave = servicio.JWT_SECRET
    return {'Authorization': 'Bearer ' + jwt.encode({'sub': str(usuario_id), 'rol': rol}, clave, algorithm='HS256')}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path}/pedidos.db')
    monkeypatch.setattr(servicio, 'fetch_producto', lambda pid: PRODUCTOS.get(pid))
    monkeypatch.setattr(servicio, 'fetch_diseno', lambda codigo: DISENO if codigo == DISENO['codigo'] else None)
    monkeypatch.setattr(servicio, 'fetch_perfil', lambda: {'correo': 'cliente@example.test'})
    monkeypatch.setattr(servicio, 'enviar_notificaciones', lambda *args: {'negocio': 'enviado', 'cliente': 'enviado'})
    app = servicio.create_app({'COMPROBANTES_DIR': str(tmp_path / 'comprobantes'), 'TESTING': True})
    yield app.test_client()
    with app.app_context():
        servicio.db.session.remove()
        servicio.db.engine.dispose()


@pytest.fixture
def compra():
    return {
        'nombre_cliente': 'Constanza Morales',
        'telefono_cliente': '+56 9 1234 5678',
        'metodo_entrega': 'metro',
        'detalle_entrega': {'estacion': 'Rojas Magallanes', 'horario': 'sábado'},
        'items': [{'id_producto': 6, 'cantidad': 2}, {'codigo_solicitud': 'a' * 32, 'cantidad': 1}],
        'metodo_pago': 'transferencia',
        'total_aceptado': 2 * 3990 + 14990,
    }
