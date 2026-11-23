from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

from checkout import transferencia_config

db = SQLAlchemy()

CATEGORIA_DISENO = 'Diseño personalizado'


def utc_now():
    # Sin zona horaria: así se guarda igual en SQLite y PostgreSQL y se puede comparar.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EstadoPedido(db.Model):
    __tablename__ = 'estado_pedido'

    id_estado_pedido = db.Column(db.Integer, primary_key=True)
    nombre_estado = db.Column(db.String(40), unique=True, nullable=False)
    descripcion = db.Column(db.String(200))
    orden = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {'id': self.nombre_estado, 'descripcion': self.descripcion, 'orden': self.orden}


class Pedido(db.Model):
    __tablename__ = 'pedido'

    id_pedido = db.Column(db.Integer, primary_key=True)
    # id_usuario vive en el servicio de usuarios: se guarda sin FK (base de datos por servicio).
    id_usuario = db.Column(db.Integer, nullable=True)
    id_estado_pedido = db.Column(db.Integer, db.ForeignKey('estado_pedido.id_estado_pedido'), nullable=False)
    fecha_pedido = db.Column(db.DateTime, default=utc_now)
    nombre_cliente = db.Column(db.String(120), nullable=False)
    telefono_cliente = db.Column(db.String(30), nullable=False)
    metodo_entrega = db.Column(db.String(20), nullable=False)
    detalle_entrega = db.Column(db.JSON, default=dict)
    total = db.Column(db.Integer, nullable=False)
    observacion = db.Column(db.Text)
    correo_cliente = db.Column(db.String(120))
    subtotal_productos = db.Column(db.Integer)
    costo_envio = db.Column(db.Integer, default=0)
    envio = db.Column(db.JSON)
    codigo_seguimiento = db.Column(db.String(100))
    # Los pedidos previos siguen como 'coordinado'; solo los nuevos requieren revisión de transferencia.
    metodo_pago = db.Column(db.String(30), default='coordinado')
    estado_pago = db.Column(db.String(30), default='pendiente')
    observacion_pago = db.Column(db.String(500))
    fecha_pago = db.Column(db.DateTime)
    notificaciones = db.Column(db.JSON, default=dict)
    clave_idempotencia = db.Column(db.String(36))
    __table_args__ = (db.UniqueConstraint('id_usuario', 'clave_idempotencia', name='uq_pedido_usuario_clave'),)

    estado = db.relationship('EstadoPedido')
    detalles = db.relationship('DetallePedido', backref='pedido', cascade='all, delete-orphan')
    personalizados = db.relationship('DetallePersonalizado', backref='pedido', cascade='all, delete-orphan')
    historial = db.relationship('HistorialEstado', backref='pedido', cascade='all, delete-orphan',
                                order_by='HistorialEstado.id_historial')
    comprobantes = db.relationship('ComprobantePago', backref='pedido', cascade='all, delete-orphan',
                                  order_by='ComprobantePago.id_comprobante')

    @property
    def items(self):
        return [d.to_dict() for d in self.detalles] + [d.to_dict() for d in self.personalizados]

    def resumen(self):
        """Datos básicos para listas (historial del cliente y pedidos recibidos del administrador)."""
        return {
            'id': self.id_pedido,
            'id_usuario': self.id_usuario,
            'fecha': self.fecha_pedido.isoformat(),
            'estado': self.estado.nombre_estado,
            'cliente': self.nombre_cliente,
            'total': self.total,
            'metodo_entrega': self.metodo_entrega,
            'estado_pago': self.estado_pago or 'pendiente',
            'metodo_pago': self.metodo_pago or 'coordinado',
            'cantidad_productos': sum(item['cantidad'] for item in self.items),
        }

    def to_dict(self):
        return self.resumen() | {
            'telefono': self.telefono_cliente,
            'detalle_entrega': self.detalle_entrega,
            'observacion': self.observacion,
            'items': self.items,
            'historial': [h.to_dict() for h in self.historial],
            'correo': self.correo_cliente,
            'subtotal': self.subtotal_productos if self.subtotal_productos is not None else self.total - (self.costo_envio or 0),
            'costo_envio': self.costo_envio or 0,
            'envio': self.envio,
            'codigo_seguimiento': self.codigo_seguimiento,
            'pago': {
                'metodo': self.metodo_pago or 'coordinado',
                'estado': self.estado_pago or 'pendiente',
                'observacion': self.observacion_pago,
                'fecha': self.fecha_pago.isoformat() if self.fecha_pago else None,
                'transferencia': transferencia_config(),
                'comprobantes': [c.to_dict() for c in self.comprobantes],
            },
            'notificaciones': self.notificaciones or {'negocio': 'no_configurado', 'cliente': 'no_configurado'},
        }


class DetallePedido(db.Model):
    __tablename__ = 'detalle_pedido'

    id_detalle_pedido = db.Column(db.Integer, primary_key=True)
    id_pedido = db.Column(db.Integer, db.ForeignKey('pedido.id_pedido'), nullable=False)
    # id_producto pertenece al servicio de catálogo; guardamos nombre, categoría y precio del momento.
    id_producto = db.Column(db.Integer, nullable=False)
    nombre_producto = db.Column(db.String(120), nullable=False)
    categoria = db.Column(db.String(60))
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Integer, nullable=False)
    subtotal = db.Column(db.Integer, nullable=False)

    def to_dict(self):
        return {
            'tipo': 'producto',
            'id_producto': self.id_producto,
            'nombre': self.nombre_producto,
            'categoria': self.categoria,
            'cantidad': self.cantidad,
            'precio_unitario': self.precio_unitario,
            'subtotal': self.subtotal,
        }


class DetallePersonalizado(db.Model):
    """Diseño de "Crea desde cero" dentro de un pedido. La solicitud vive en el servicio de personalización."""
    __tablename__ = 'detalle_personalizado'

    id_detalle = db.Column(db.Integer, primary_key=True)
    id_pedido = db.Column(db.Integer, db.ForeignKey('pedido.id_pedido'), nullable=False)
    codigo_solicitud = db.Column(db.String(32), nullable=False)
    nombre = db.Column(db.String(120), nullable=False)
    detalle = db.Column(db.String(200))
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Integer, nullable=False)
    subtotal = db.Column(db.Integer, nullable=False)

    def to_dict(self):
        return {
            'tipo': 'personalizado',
            'codigo_solicitud': self.codigo_solicitud,
            'nombre': self.nombre,
            'categoria': CATEGORIA_DISENO,
            'detalle': self.detalle,
            'cantidad': self.cantidad,
            'precio_unitario': self.precio_unitario,
            'subtotal': self.subtotal,
        }


class HistorialEstado(db.Model):
    """Cada cambio de estado de un pedido, para que el cliente vea en qué etapa va y desde cuándo."""
    __tablename__ = 'historial_estado'

    id_historial = db.Column(db.Integer, primary_key=True)
    id_pedido = db.Column(db.Integer, db.ForeignKey('pedido.id_pedido'), nullable=False)
    estado = db.Column(db.String(40), nullable=False)
    fecha = db.Column(db.DateTime, default=utc_now)
    comentario = db.Column(db.String(300))

    def to_dict(self):
        return {'estado': self.estado, 'fecha': self.fecha.isoformat(), 'comentario': self.comentario}


class ComprobantePago(db.Model):
    """Archivo privado; la decisión registra quién revisó la transferencia."""
    __tablename__ = 'comprobante_pago'

    id_comprobante = db.Column(db.Integer, primary_key=True)
    id_pedido = db.Column(db.Integer, db.ForeignKey('pedido.id_pedido'), nullable=False)
    nombre_original = db.Column(db.String(255), nullable=False)
    archivo = db.Column(db.String(80), nullable=False, unique=True)
    mime = db.Column(db.String(30), nullable=False)
    fecha = db.Column(db.DateTime, default=utc_now)
    estado = db.Column(db.String(30), default='en_revision', nullable=False)
    referencia_transferencia = db.Column(db.String(120))
    observacion = db.Column(db.String(500))
    revisado_por = db.Column(db.Integer)
    fecha_revision = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'id': self.id_comprobante, 'nombre': self.nombre_original,
            'fecha': self.fecha.isoformat(), 'estado': self.estado,
            'referencia_transferencia': self.referencia_transferencia,
            'observacion': self.observacion,
            'fecha_revision': self.fecha_revision.isoformat() if self.fecha_revision else None,
            'archivo_url': f'/pedidos/pedidos/{self.id_pedido}/comprobantes/{self.id_comprobante}',
        }
