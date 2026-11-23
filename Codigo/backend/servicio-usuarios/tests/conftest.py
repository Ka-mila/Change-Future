import os
import sys
import tempfile

import pytest

# Base de datos temporal: se configura antes de importar app.py.
_db_dir = tempfile.mkdtemp()
os.environ['DATABASE_URL'] = f'sqlite:///{_db_dir}/import.db'
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import app as servicio  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Ninguna prueba debe usar credenciales reales o contactar un servidor SMTP.
    for nombre in ('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_APP_PASSWORD', 'SMTP_FROM'):
        monkeypatch.delenv(nombre, raising=False)
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{tmp_path}/usuarios.db')
    return servicio.create_app().test_client()


@pytest.fixture
def datos_validos():
    return {
        'nombre': 'Constanza',
        'apellido': 'Morales',
        'correo': 'constanza@ejemplo.cl',
        'rut': '12.345.678-5',
        'telefono': '+56 9 1234 5678',
        'contrasena': 'clave1234',
    }


@pytest.fixture
def registrado(client, datos_validos):
    respuesta = client.post('/registro', json=datos_validos)
    return {'Authorization': f'Bearer {respuesta.get_json()["token"]}'}
