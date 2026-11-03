"""Microservicio de usuarios: registro, inicio de sesión y perfil."""
import os
from datetime import datetime, timedelta, timezone

import jwt
from flask import Flask, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from models import Rol, Usuario, db

JWT_SECRET = os.getenv('JWT_SECRET', 'cambia-esta-clave-en-produccion')
TOKEN_HOURS = 8


def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///usuarios.db')
    db.init_app(app)

    with app.app_context():
        db.create_all()
        seed_roles()
        db.engine.dispose()  # cada worker de gunicorn abre sus propias conexiones

    register_routes(app)
    return app


def seed_roles():
    for nombre, descripcion in [('cliente', 'Compra y solicita diseños'),
                                ('administrador', 'Gestiona catálogo y pedidos')]:
        if not Rol.query.filter_by(nombre_rol=nombre).first():
            db.session.add(Rol(nombre_rol=nombre, descripcion=descripcion))
    db.session.commit()


def create_token(usuario):
    payload = {
        'sub': str(usuario.id_usuario),
        'nombre': usuario.nombre,
        'rol': usuario.rol.nombre_rol,
        'exp': datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def current_user_id():
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None
    try:
        payload = jwt.decode(header[7:], JWT_SECRET, algorithms=['HS256'])
    except jwt.PyJWTError:
        return None
    return int(payload['sub'])


def register_routes(app):
    @app.get('/health')
    def health():
        return jsonify(status='ok')

    @app.post('/registro')
    def registro():
        data = request.get_json(silent=True) or {}
        nombre = (data.get('nombre') or '').strip()
        correo = (data.get('correo') or '').strip().lower()
        contrasena = data.get('contrasena') or ''

        if not nombre or not correo or len(contrasena) < 8:
            return jsonify(error='Nombre, correo y contraseña (mínimo 8 caracteres) son obligatorios'), 400
        if Usuario.query.filter_by(correo=correo).first():
            return jsonify(error='Ya existe una cuenta con ese correo'), 409

        usuario = Usuario(
            nombre=nombre,
            apellido=data.get('apellido'),
            correo=correo,
            telefono=data.get('telefono'),
            contrasena_hash=generate_password_hash(contrasena),
            rol=Rol.query.filter_by(nombre_rol='cliente').first(),
        )
        db.session.add(usuario)
        db.session.commit()
        return jsonify(token=create_token(usuario), usuario=usuario.to_dict()), 201

    @app.post('/login')
    def login():
        data = request.get_json(silent=True) or {}
        correo = (data.get('correo') or '').strip().lower()
        usuario = Usuario.query.filter_by(correo=correo).first()

        if not usuario or not check_password_hash(usuario.contrasena_hash, data.get('contrasena') or ''):
            return jsonify(error='Correo o contraseña incorrectos'), 401
        return jsonify(token=create_token(usuario), usuario=usuario.to_dict())

    @app.get('/perfil')
    def perfil():
        user_id = current_user_id()
        usuario = db.session.get(Usuario, user_id) if user_id else None
        if not usuario:
            return jsonify(error='Sesión inválida o expirada'), 401
        return jsonify(usuario.to_dict())


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5001)), debug=True)
