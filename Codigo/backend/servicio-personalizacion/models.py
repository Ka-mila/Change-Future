from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class SolicitudPersonalizacion(db.Model):
    __tablename__ = 'solicitud_personalizacion'

    id_solicitud = db.Column(db.Integer, primary_key=True)
    id_usuario = db.Column(db.Integer, nullable=True)
    id_producto = db.Column(db.Integer, nullable=True)
    tipo = db.Column(db.String(60), nullable=False)
    descripcion = db.Column(db.Text)
    tamano = db.Column(db.String(60))
    cantidad = db.Column(db.String(40))
    acabado = db.Column(db.String(40))
    nombre_contacto = db.Column(db.String(120), nullable=False)
    correo_contacto = db.Column(db.String(120), nullable=False)
    telefono_contacto = db.Column(db.String(30))
    ciudad = db.Column(db.String(80))
    imagen_referencia = db.Column(db.String(255))
    fecha_solicitud = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    estado = db.Column(db.String(30), default='recibida')

    def to_dict(self):
        return {
            'id': self.id_solicitud,
            'tipo': self.tipo,
            'descripcion': self.descripcion,
            'tamano': self.tamano,
            'cantidad': self.cantidad,
            'acabado': self.acabado,
            'nombre': self.nombre_contacto,
            'correo': self.correo_contacto,
            'telefono': self.telefono_contacto,
            'ciudad': self.ciudad,
            'imagen_referencia': self.imagen_referencia,
            'fecha': self.fecha_solicitud.isoformat(),
            'estado': self.estado,
        }
