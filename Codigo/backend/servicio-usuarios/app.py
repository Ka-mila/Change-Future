"""Microservicio de usuarios: registro, sesión, perfil y recuperación de contraseña."""
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from sqlalchemy import inspect, text
from werkzeug.security import check_password_hash, generate_password_hash

from correo import correo_configurado, enviar_enlace_recuperacion
from models import Rol, TokenRecuperacion, Usuario, db
from validaciones import correo_valido, error_contrasena, normalizar_rut, validar_datos_personales

SERVICE_DIR = Path(__file__).resolve().parent
# Las variables del sistema tienen prioridad; después, la raíz comparte SMTP.
# El .env del servicio completa valores faltantes por compatibilidad.
load_dotenv(SERVICE_DIR.parent.parent / '.env', override=False)
load_dotenv(SERVICE_DIR / '.env', override=False)

JWT_SECRET = os.getenv('JWT_SECRET', 'cambia-esta-clave-secreta-en-produccion')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
TOKEN_HOURS = 8
RECUPERACION_MINUTOS = 30


def create_app():
    app = Flask(__name__, instance_path=str(SERVICE_DIR / 'instance'))
    os.makedirs(app.instance_path, exist_ok=True)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///usuarios.db')
    db.init_app(app)

    with app.app_context():
        db.create_all()
        agregar_columnas_nuevas()
        seed_roles()
        db.engine.dispose()  # cada worker de gunicorn abre sus propias conexiones

    register_routes(app)
    return app


def agregar_columnas_nuevas():
    """create_all no modifica tablas existentes: agrega la columna rut a bases ya creadas."""
    columnas = {c['name'] for c in inspect(db.engine).get_columns('usuario')}
    if 'rut' not in columnas:
        with db.engine.begin() as conexion:
            conexion.execute(text('ALTER TABLE usuario ADD COLUMN rut VARCHAR(12)'))
            conexion.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS ix_usuario_rut ON usuario (rut)'))


def seed_roles():
    for nombre, descripcion in [('cliente', 'Compra y solicita diseños'),
                                ('administrador', 'Gestiona catálogo y pedidos')]:
        if not Rol.query.filter_by(nombre_rol=nombre).first():
            db.session.add(Rol(nombre_rol=nombre, descripcion=descripcion))
    db.session.commit()


def utc_now():
    # Sin zona horaria, para comparar con lo que devuelve la base de datos.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_token(usuario):
    payload = {
        'sub': str(usuario.id_usuario),
        'nombre': usuario.nombre,
        'rol': usuario.rol.nombre_rol,
        'exp': datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def usuario_actual():
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None
    try:
        payload = jwt.decode(header[7:], JWT_SECRET, algorithms=['HS256'])
        usuario_id = int(payload['sub'])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None
    usuario = db.session.get(Usuario, usuario_id)
    return usuario if usuario and usuario.estado == 'activo' else None


def error(mensaje, status=400, campos=None):
    body = {'error': mensaje}
    if campos:
        body['campos'] = campos
    return jsonify(body), status


def register_routes(app):
    @app.get('/health')
    def health():
        return jsonify(status='ok')

    # HU01.1 Registro
    @app.post('/registro')
    def registro():
        data = request.get_json(silent=True) or {}
        correo = (data.get('correo') or '').strip().lower()
        rut = normalizar_rut(data.get('rut'))

        campos = validar_datos_personales(data, {'nombre', 'apellido', 'telefono'})
        if not correo:
            campos['correo'] = 'El correo es obligatorio'
        elif not correo_valido(correo):
            campos['correo'] = 'El correo no tiene un formato válido'
        if not (data.get('rut') or '').strip():
            campos['rut'] = 'El RUT es obligatorio'
        elif not rut:
            campos['rut'] = 'El RUT no es válido'
        if motivo := error_contrasena(data.get('contrasena')):
            campos['contrasena'] = motivo
        if campos:
            return error('Revisa los datos ingresados', campos=campos)

        if Usuario.query.filter_by(correo=correo).first():
            return error('Ya existe una cuenta con ese correo', 409, {'correo': 'Este correo ya está registrado'})
        if Usuario.query.filter_by(rut=rut).first():
            return error('Ya existe una cuenta con ese RUT', 409, {'rut': 'Este RUT ya está registrado'})

        usuario = Usuario(
            nombre=data['nombre'].strip(),
            apellido=data['apellido'].strip(),
            rut=rut,
            correo=correo,
            telefono=(data.get('telefono') or '').strip() or None,
            contrasena_hash=generate_password_hash(data['contrasena']),
            rol=Rol.query.filter_by(nombre_rol='cliente').first(),
        )
        db.session.add(usuario)
        db.session.commit()
        return jsonify(
            mensaje='¡Tu cuenta fue creada con éxito!',
            token=create_token(usuario),
            usuario=usuario.to_dict(),
        ), 201

    # HU01.2 Inicio de sesión
    @app.post('/login')
    def login():
        data = request.get_json(silent=True) or {}
        correo = (data.get('correo') or '').strip().lower()
        if not correo or not data.get('contrasena'):
            return error('Ingresa tu correo y tu contraseña')

        usuario = Usuario.query.filter_by(correo=correo).first()
        if (not usuario or usuario.estado != 'activo'
                or not check_password_hash(usuario.contrasena_hash, data['contrasena'])):
            return error('Correo o contraseña incorrectos', 401)
        return jsonify(token=create_token(usuario), usuario=usuario.to_dict())

    # HU01.4 Consultar y modificar datos personales
    @app.get('/perfil')
    def perfil():
        usuario = usuario_actual()
        if not usuario:
            return error('Sesión inválida o expirada', 401)
        return jsonify(usuario.to_dict())

    @app.put('/perfil')
    def actualizar_perfil():
        usuario = usuario_actual()
        if not usuario:
            return error('Sesión inválida o expirada', 401)

        # El correo y el RUT identifican la cuenta, por eso no se modifican aquí.
        data = request.get_json(silent=True) or {}
        if campos := validar_datos_personales(data, {'nombre', 'apellido', 'telefono'}):
            return error('Revisa los datos ingresados', campos=campos)

        usuario.nombre = data['nombre'].strip()
        usuario.apellido = data['apellido'].strip()
        usuario.telefono = (data.get('telefono') or '').strip() or None
        db.session.commit()
        return jsonify(mensaje='Tus datos se guardaron correctamente', usuario=usuario.to_dict())

    @app.put('/perfil/contrasena')
    def cambiar_contrasena():
        usuario = usuario_actual()
        if not usuario:
            return error('Sesión inválida o expirada', 401)

        data = request.get_json(silent=True) or {}
        if not check_password_hash(usuario.contrasena_hash, data.get('actual') or ''):
            return error('La contraseña actual no es correcta', campos={'actual': 'La contraseña actual no es correcta'})
        if motivo := error_contrasena(data.get('nueva')):
            return error(motivo, campos={'nueva': motivo})

        usuario.contrasena_hash = generate_password_hash(data['nueva'])
        db.session.commit()
        return jsonify(mensaje='Tu contraseña se actualizó correctamente')

    # HU06.4 Consultar clientes (administrador)
    @app.get('/clientes')
    def listar_clientes():
        admin = usuario_actual()
        if not admin or admin.rol.nombre_rol != 'administrador':
            return error('Solo un administrador puede ver los clientes', 403)

        query = Usuario.query.join(Rol).filter(Rol.nombre_rol == 'cliente')
        if busqueda := (request.args.get('q') or '').strip():
            like = f'%{busqueda}%'
            rut = normalizar_rut(busqueda)
            query = query.filter(db.or_(
                Usuario.nombre.ilike(like), Usuario.apellido.ilike(like), Usuario.correo.ilike(like),
                Usuario.telefono.ilike(like), Usuario.rut == rut if rut else Usuario.rut.ilike(like),
            ))
        return jsonify([u.to_dict() | {'estado': u.estado} for u in query.order_by(Usuario.fecha_registro.desc())])

    @app.get('/clientes/<int:usuario_id>')
    def ver_cliente(usuario_id):
        admin = usuario_actual()
        if not admin or admin.rol.nombre_rol != 'administrador':
            return error('Solo un administrador puede ver los clientes', 403)
        cliente = db.session.get(Usuario, usuario_id)
        if not cliente:
            return error('Cliente no encontrado', 404)
        return jsonify(cliente.to_dict() | {'estado': cliente.estado})

    # HU01.5 Recuperar contraseña
    @app.post('/recuperar')
    def recuperar():
        correo = ((request.get_json(silent=True) or {}).get('correo') or '').strip().lower()
        if not correo_valido(correo):
            return error('Ingresa un correo válido', campos={'correo': 'Ingresa un correo válido'})

        configurado = correo_configurado()
        usuario = Usuario.query.filter_by(correo=correo, estado='activo').first()
        if usuario and configurado:
            token = secrets.token_urlsafe(32)
            db.session.add(TokenRecuperacion(
                usuario=usuario,
                token_hash=hash_token(token),
                fecha_expiracion=utc_now() + timedelta(minutes=RECUPERACION_MINUTOS),
            ))
            db.session.commit()
            try:
                enviar_enlace_recuperacion(
                    usuario.correo, usuario.nombre,
                    f'{FRONTEND_URL.rstrip("/")}/restablecer?token={token}',
                )
            except Exception as exc:
                # No registrar el enlace, el destinatario ni detalles SMTP:
                # algunas excepciones pueden contener datos privados.
                app.logger.warning('No se pudo completar la recuperación (%s).', type(exc).__name__)

        # Mismo mensaje exista o no la cuenta, para no revelar qué correos están registrados.
        if configurado:
            mensaje = (
                'Si el correo está registrado y el envío pudo completarse, recibirás un enlace '
                'para restablecer tu contraseña. '
                f'Es válido durante {RECUPERACION_MINUTOS} minutos. '
                'Revisa también Spam; si no llega, contacta a Change Future.'
            )
        else:
            mensaje = (
                'Recibimos tu solicitud. El envío de correos aún no está configurado. '
                'Contacta a Change Future para recuperar el acceso.'
            )
        return jsonify(mensaje=mensaje, correo_configurado=configurado)

    @app.post('/restablecer')
    def restablecer():
        data = request.get_json(silent=True) or {}
        registro_token = TokenRecuperacion.query.filter_by(token_hash=hash_token(data.get('token') or '')).first()
        if not registro_token or registro_token.usado or registro_token.fecha_expiracion < utc_now():
            return error('El enlace no es válido o ya venció. Solicita uno nuevo.')
        if motivo := error_contrasena(data.get('contrasena')):
            return error(motivo, campos={'contrasena': motivo})

        registro_token.usado = True
        registro_token.usuario.contrasena_hash = generate_password_hash(data['contrasena'])
        db.session.commit()
        return jsonify(mensaje='Tu contraseña se restableció. Ya puedes iniciar sesión.')


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5001)), debug=True)
