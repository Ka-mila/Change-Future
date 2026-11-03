from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


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
    correo = db.Column(db.String(120), unique=True, nullable=False)
    contrasena_hash = db.Column(db.String(255), nullable=False)
    telefono = db.Column(db.String(30))
    fecha_registro = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    estado = db.Column(db.String(20), default='activo')

    rol = db.relationship('Rol')

    def to_dict(self):
        return {
            'id': self.id_usuario,
            'nombre': self.nombre,
            'apellido': self.apellido,
            'correo': self.correo,
            'telefono': self.telefono,
            'rol': self.rol.nombre_rol,
            'fecha_registro': self.fecha_registro.isoformat(),
        }
