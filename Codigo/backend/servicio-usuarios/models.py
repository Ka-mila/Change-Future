from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def ahora():
    return datetime.now(timezone.utc)


class Rol(db.Model):
    __tablename__ = 'rol'

    id_rol = db.Column(db.Integer, primary_key=True)
    nombre_rol = db.Column(db.String(40), unique=True, nullable=False)
    descripcion = db.Column(db.String(200))


class Usuario(db.Model):
    __tablename__ = 'usuario'

    id_usuario = db.Column(db.Integer, primary_key=True)
    id_rol = db.Column(db.Integer, db.ForeignKey('rol.id_rol'), nullable=False)
    nombre = db.Column(db.String(80), nullable=False)
    apellido = db.Column(db.String(80))
    rut = db.Column(db.String(12), unique=True)
    correo = db.Column(db.String(120), unique=True, nullable=False)
    contrasena_hash = db.Column(db.String(255), nullable=False)
    telefono = db.Column(db.String(30))
    fecha_registro = db.Column(db.DateTime, default=ahora)
    estado = db.Column(db.String(20), default='activo')

    rol = db.relationship('Rol')

    def to_dict(self):
        return {
            'id': self.id_usuario,
            'nombre': self.nombre,
            'apellido': self.apellido,
            'rut': self.rut,
            'correo': self.correo,
            'telefono': self.telefono,
            'rol': self.rol.nombre_rol,
            'fecha_registro': self.fecha_registro.isoformat(),
        }


class TokenRecuperacion(db.Model):
    """Enlace de un solo uso para restablecer la contraseña. Se guarda solo el hash."""
    __tablename__ = 'token_recuperacion'

    id_token = db.Column(db.Integer, primary_key=True)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id_usuario'), nullable=False)
    token_hash = db.Column(db.String(64), unique=True, nullable=False)
    fecha_expiracion = db.Column(db.DateTime, nullable=False)
    usado = db.Column(db.Boolean, default=False)

    usuario = db.relationship('Usuario')
