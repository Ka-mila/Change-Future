from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def ahora():
    return datetime.now(timezone.utc)


class Color(db.Model):
    __tablename__ = 'color'

    id_color = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(40), unique=True, nullable=False)
    codigo_hex = db.Column(db.String(7), nullable=False)
    estado = db.Column(db.String(20), default='activo')

    def to_dict(self):
        return {'id': self.id_color, 'nombre': self.nombre, 'hex': self.codigo_hex}


class Tamano(db.Model):
    __tablename__ = 'tamano'

    id_tamano = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(40), unique=True, nullable=False)
    descripcion = db.Column(db.String(120))
    medida_mm = db.Column(db.Integer, nullable=False)  # lado más largo de la pieza
    precio_referencial = db.Column(db.Integer, nullable=False)
    estado = db.Column(db.String(20), default='activo')

    def to_dict(self):
        return {
            'id': self.id_tamano,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'medida_mm': self.medida_mm,
            'precio': self.precio_referencial,
        }


class SolicitudPersonalizacion(db.Model):
    __tablename__ = 'solicitud_personalizacion'

    id_solicitud = db.Column(db.Integer, primary_key=True)
    # Código público: el navegador usa este en vez del id para que no se puedan adivinar solicitudes ajenas.
    codigo = db.Column(db.String(32), unique=True)
    id_usuario = db.Column(db.Integer, nullable=True)
    id_producto = db.Column(db.Integer, nullable=True)
    tipo = db.Column(db.String(60), nullable=False)
    descripcion = db.Column(db.Text)
    estilo = db.Column(db.String(20))
    id_color = db.Column(db.Integer, db.ForeignKey('color.id_color'))
    id_tamano = db.Column(db.Integer, db.ForeignKey('tamano.id_tamano'))
    # Columnas del formulario anterior (contacto); se conservan para no perder solicitudes antiguas.
    tamano = db.Column(db.String(60))
    cantidad = db.Column(db.String(40))
    acabado = db.Column(db.String(40))
    nombre_contacto = db.Column(db.String(120), nullable=False, default='')
    correo_contacto = db.Column(db.String(120), nullable=False, default='')
    telefono_contacto = db.Column(db.String(30))
    ciudad = db.Column(db.String(80))
    imagen_referencia = db.Column(db.String(255))
    fecha_solicitud = db.Column(db.DateTime, default=ahora)
    estado = db.Column(db.String(30), default='borrador')

    color = db.relationship('Color')
    tamano_elegido = db.relationship('Tamano')
    propuestas = db.relationship('PropuestaDiseno', backref='solicitud', order_by='PropuestaDiseno.id_propuesta')

    @property
    def propuesta(self):
        return self.propuestas[-1] if self.propuestas else None

    @property
    def nombre_item(self):
        return f'Diseño personalizado: {self.tipo}'

    @property
    def detalle_item(self):
        partes = [
            self.propuesta.estilo.capitalize() if self.propuesta else None,
            self.color.nombre if self.color else None,
            f'{self.tamano_elegido.nombre} ({self.tamano_elegido.medida_mm / 10:g} cm)' if self.tamano_elegido else None,
        ]
        return ' · '.join(p for p in partes if p)

    def to_dict(self):
        return {
            'codigo': self.codigo,
            'tipo': self.tipo,
            'descripcion': self.descripcion,
            'estado': self.estado,
            'color': self.color.to_dict() if self.color else None,
            'tamano': self.tamano_elegido.to_dict() if self.tamano_elegido else None,
            'precio': self.tamano_elegido.precio_referencial if self.tamano_elegido else None,
            'propuesta': self.propuesta.to_dict() if self.propuesta else None,
            'nombre_item': self.nombre_item,
            'detalle_item': self.detalle_item,
            'fecha': self.fecha_solicitud.isoformat(),
        }

    def admin_dict(self):
        """Lo que necesita el administrador: cliente asociado, imagen y observaciones."""
        return self.to_dict() | {
            'id_usuario': self.id_usuario,
            'imagen_referencia': self.imagen_referencia,
            'estilo': self.estilo,
            # Solo las solicitudes del formulario anterior tienen datos de contacto propios
            'contacto': {
                'nombre': self.nombre_contacto, 'correo': self.correo_contacto,
                'telefono': self.telefono_contacto, 'ciudad': self.ciudad,
            } if self.nombre_contacto else None,
            'observaciones': self.propuesta.observaciones if self.propuesta else None,
        }


class PropuestaDiseno(db.Model):
    __tablename__ = 'propuesta_diseno'

    id_propuesta = db.Column(db.Integer, primary_key=True)
    id_solicitud = db.Column(db.Integer, db.ForeignKey('solicitud_personalizacion.id_solicitud'), nullable=False)
    estilo = db.Column(db.String(20), nullable=False)
    archivo_propuesta = db.Column(db.String(255), nullable=False)
    ancho_mm = db.Column(db.Float)
    alto_mm = db.Column(db.Float)
    profundidad_mm = db.Column(db.Float)
    fecha_generacion = db.Column(db.DateTime, default=ahora)
    estado_aprobacion = db.Column(db.String(20), default='pendiente')
    observaciones = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id_propuesta,
            'estilo': self.estilo,
            'ancho_mm': self.ancho_mm,
            'alto_mm': self.alto_mm,
            'profundidad_mm': self.profundidad_mm,
            'estado_aprobacion': self.estado_aprobacion,
            'fecha': self.fecha_generacion.isoformat(),
        }
