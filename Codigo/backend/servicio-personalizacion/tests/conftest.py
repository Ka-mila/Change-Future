import io
import os
import sys
import tempfile

import pytest
import requests

_dir = tempfile.mkdtemp()
os.environ['DATABASE_URL'] = f'sqlite:///{_dir}/import.db'
os.environ['UPLOAD_DIR'] = os.path.join(_dir, 'uploads')
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app as servicio  # noqa: E402

PNG = b'\x89PNG\r\n\x1a\n' + b'0' * 100


class RespuestaFalsa:
    def __init__(self, status=200, content=b'solid', headers=None, json=None):
        self.status_code = status
        self.ok = status < 400
        self.content = content
        self.headers = headers or {}
        self._json = json

    def json(self):
        if self._json is None:
            raise ValueError
        return self._json


@pytest.fixture
def procesamiento(monkeypatch):
    """Reemplaza al servicio de procesamiento. Cambia .respuesta para simular errores."""
    class Falso:
        respuesta = RespuestaFalsa(headers={'X-ancho-mm': '100.0', 'X-alto-mm': '70.0', 'X-profundidad-mm': '4.0'})
        llamadas = []

        def post(self, url, **kwargs):
            self.llamadas.append(kwargs)
            if isinstance(self.respuesta, Exception):
                raise self.respuesta
            return self.respuesta

    falso = Falso()
    monkeypatch.setattr(servicio.requests, 'post', falso.post)
    return falso


@pytest.fixture
def client(tmp_path, monkeypatch, procesamiento):
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path}/personalizacion.db')
    return servicio.create_app().test_client()


@pytest.fixture
def subir(client):
    def _subir(datos=PNG, nombre='idea.png', estilo='silueta', tipo='Decoración'):
        return client.post('/solicitudes', data={
            'tipo': tipo, 'descripcion': 'Un llavero con mi perro', 'estilo': estilo,
            'imagen': (io.BytesIO(datos), nombre),
        }, content_type='multipart/form-data')
    return _subir


ConnectionError = requests.ConnectionError
