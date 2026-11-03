from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class EstadoPedido(db.Model):
    __tablename__ = 'estado_pedido'

    id_estado_pedido = db.Column(db.Integer, primary_key=True)
    nombre_estado = db.Column(db.String(40), unique=True, nullable=False)
    descripcion = db.Column(db.String(200))


class Pedido(db.Model):
    __tablename__ = 'pedido'

    id_pedido = db.Column(db.Integer, primary_key=True)
    # id_usuario vive en el servicio de usuarios: se guarda sin FK (base de datos por servicio).
    id_usuario = db.Column(db.Integer, nullable=True)
    id_estado_pedido = db.Column(db.Integer, db.ForeignKey('estado_pedido.id_estado_pedido'), nullable=False)
    fecha_pedido = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    nombre_cliente = db.Column(db.String(120), nullable=False)
    telefono_cliente = db.Column(db.String(30), nullable=False)
    metodo_entrega = db.Column(db.String(20), nullable=False)
    detalle_entrega = db.Column(db.JSON, default=dict)
    total = db.Column(db.Integer, nullable=False)
    observacion = db.Column(db.Text)

    estado = db.relationship('EstadoPedido')
    detalles = db.relationship('DetallePedido', backref='pedido', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id_pedido,
            'estado': self.estado.nombre_estado,
            'fecha': self.fecha_pedido.isoformat(),
            'cliente': self.nombre_cliente,
            'telefono': self.telefono_cliente,
            'metodo_entrega': self.metodo_entrega,
            'detalle_entrega': self.detalle_entrega,
            'total': self.total,
            'items': [d.to_dict() for d in self.detalles],
        }


class DetallePedido(db.Model):
    __tablename__ = 'detalle_pedido'

    id_detalle_pedido = db.Column(db.Integer, primary_key=True)
    id_pedido = db.Column(db.Integer, db.ForeignKey('pedido.id_pedido'), nullable=False)
    # id_producto pertenece al servicio de catálogo; guardamos nombre y precio del momento.
    id_producto = db.Column(db.Integer, nullable=False)
    nombre_producto = db.Column(db.String(120), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Integer, nullable=False)
    subtotal = db.Column(db.Integer, nullable=False)

    def to_dict(self):
        return {
            'id_producto': self.id_producto,
            'nombre': self.nombre_producto,
            'cantidad': self.cantidad,
            'precio_unitario': self.precio_unitario,
            'subtotal': self.subtotal,
        }
