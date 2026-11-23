import os
import sys
import tempfile

import jwt
import pytest

_dir = tempfile.mkdtemp()
os.environ['DATABASE_URL'] = f'sqlite:///{_dir}/import.db'
os.environ['UPLOAD_DIR'] = os.path.join(_dir, 'uploads')
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app as servicio  # noqa: E402

PNG = b'\x89PNG\r\n\x1a\n' + b'0' * 64


def token(rol):
    return {'Authorization': 'Bearer ' + jwt.encode({'sub': '1', 'rol': rol}, servicio.JWT_SECRET, algorithm='HS256')}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path}/catalogo.db')
    return servicio.create_app().test_client()


@pytest.fixture
def admin():
    return token('administrador')


@pytest.fixture
def nuevo():
    return {'nombre': 'Lámpara luna', 'categoria': 'Decoración', 'precio': '15.990', 'stock': '5',
            'descripcion': 'Lámpara impresa en 3D con textura lunar.', 'material': 'PLA',
            'personalizacion': 'Personalizable'}
