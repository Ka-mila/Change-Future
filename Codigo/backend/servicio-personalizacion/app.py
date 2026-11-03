"""Microservicio de personalización: solicitudes de diseño "Crea desde cero"."""
import os
import uuid

import jwt
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from models import SolicitudPersonalizacion, db

JWT_SECRET = os.getenv('JWT_SECRET', 'cambia-esta-clave-en-produccion')
UPLOAD_DIR = os.getenv('UPLOAD_DIR', os.path.join(os.path.dirname(__file__), 'uploads'))
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'}


def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///personalizacion.db')
    app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    db.init_app(app)

    with app.app_context():
        db.create_all()
        db.engine.dispose()  # cada worker de gunicorn abre sus propias conexiones

    register_routes(app)
    return app


def token_payload():
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None
    try:
        return jwt.decode(header[7:], JWT_SECRET, algorithms=['HS256'])
    except jwt.PyJWTError:
        return None


def save_reference(file):
    extension = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if extension not in ALLOWED_EXTENSIONS:
        return None
    filename = f'{uuid.uuid4().hex}_{secure_filename(file.filename)}'
    file.save(os.path.join(UPLOAD_DIR, filename))
    return filename


def register_routes(app):
    @app.get('/health')
    def health():
        return jsonify(status='ok')

    @app.post('/solicitudes')
    def crear_solicitud():
        # multipart/form-data para poder adjuntar la imagen de referencia
        form = request.form
        if not form.get('tipo') or not form.get('nombre') or not form.get('correo'):
            return jsonify(error='Tipo de proyecto, nombre y correo son obligatorios'), 400

        imagen = None
        file = request.files.get('referencia')
        if file and file.filename:
            imagen = save_reference(file)
            if not imagen:
                return jsonify(error='Solo se aceptan imágenes JPG, PNG, WEBP, GIF o PDF'), 400

        payload = token_payload()
        solicitud = SolicitudPersonalizacion(
            id_usuario=int(payload['sub']) if payload else None,
            id_producto=form.get('id_producto', type=int),
            tipo=form['tipo'],
            descripcion=form.get('descripcion'),
            tamano=form.get('tamano'),
            cantidad=form.get('cantidad'),
            acabado=form.get('acabado'),
            nombre_contacto=form['nombre'],
            correo_contacto=form['correo'],
            telefono_contacto=form.get('telefono'),
            ciudad=form.get('ciudad'),
            imagen_referencia=imagen,
        )
        db.session.add(solicitud)
        db.session.commit()
        return jsonify(solicitud.to_dict()), 201

    @app.get('/solicitudes')
    def listar_solicitudes():
        payload = token_payload()
        if not payload:
            return jsonify(error='Debes iniciar sesión'), 401

        query = SolicitudPersonalizacion.query.order_by(SolicitudPersonalizacion.fecha_solicitud.desc())
        if payload.get('rol') != 'administrador':
            query = query.filter_by(id_usuario=int(payload['sub']))
        return jsonify([s.to_dict() for s in query.all()])

    @app.get('/referencias/<path:filename>')
    def referencia(filename):
        payload = token_payload()
        if not payload or payload.get('rol') != 'administrador':
            return jsonify(error='Solo un administrador puede ver las referencias'), 403
        return send_from_directory(UPLOAD_DIR, filename)


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5004)), debug=True)
