"""Microservicio de pedidos: crea y consulta pedidos.

Los precios se piden al servicio de catálogo para no confiar en los
valores que envía el navegador.
"""
import os

import jwt
import requests
from flask import Flask, jsonify, request

from models import DetallePedido, EstadoPedido, Pedido, db

JWT_SECRET = os.getenv('JWT_SECRET', 'cambia-esta-clave-en-produccion')
CATALOGO_URL = os.getenv('CATALOGO_URL', 'http://127.0.0.1:5002')

ESTADOS = [
    ('pendiente', 'Recibido, falta confirmar por WhatsApp'),
    ('confirmado', 'Pago y entrega acordados'),
    ('en_produccion', 'En impresión'),
    ('enviado', 'Despachado o entregado en Metro'),
    ('cancelado', 'Pedido anulado'),
]


def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///pedidos.db')
    db.init_app(app)

    with app.app_context():
        db.create_all()
        for nombre, descripcion in ESTADOS:
            if not EstadoPedido.query.filter_by(nombre_estado=nombre).first():
                db.session.add(EstadoPedido(nombre_estado=nombre, descripcion=descripcion))
        db.session.commit()
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


def fetch_producto(producto_id):
    response = requests.get(f'{CATALOGO_URL}/productos/{producto_id}', timeout=5)
    return response.json() if response.ok else None


def register_routes(app):
    @app.get('/health')
    def health():
        return jsonify(status='ok')

    @app.post('/pedidos')
    def crear_pedido():
        data = request.get_json(silent=True) or {}
        items = data.get('items') or []
        nombre = (data.get('nombre_cliente') or '').strip()
        telefono = (data.get('telefono_cliente') or '').strip()
        metodo = data.get('metodo_entrega')

        if not items or not nombre or not telefono or metodo not in ('blue', 'metro'):
            return jsonify(error='Faltan productos, nombre, teléfono o método de entrega'), 400

        detalles = []
        try:
            for item in items:
                cantidad = max(1, int(item.get('cantidad', 1)))
                producto = fetch_producto(int(item['id_producto']))
                if not producto:
                    return jsonify(error=f'El producto {item["id_producto"]} no existe'), 400
                detalles.append(DetallePedido(
                    id_producto=producto['id'],
                    nombre_producto=producto['nombre'],
                    cantidad=cantidad,
                    precio_unitario=producto['precio'],
                    subtotal=producto['precio'] * cantidad,
                ))
        except requests.RequestException:
            return jsonify(error='El catálogo no está disponible, intenta más tarde'), 503
        except (KeyError, TypeError, ValueError):
            return jsonify(error='Formato de productos inválido'), 400

        payload = token_payload()
        pedido = Pedido(
            id_usuario=int(payload['sub']) if payload else None,
            estado=EstadoPedido.query.filter_by(nombre_estado='pendiente').first(),
            nombre_cliente=nombre,
            telefono_cliente=telefono,
            metodo_entrega=metodo,
            detalle_entrega=data.get('detalle_entrega') or {},
            total=sum(d.subtotal for d in detalles),
            observacion=data.get('observacion'),
            detalles=detalles,
        )
        db.session.add(pedido)
        db.session.commit()
        return jsonify(pedido.to_dict()), 201

    @app.get('/pedidos')
    def mis_pedidos():
        payload = token_payload()
        if not payload:
            return jsonify(error='Debes iniciar sesión'), 401

        query = Pedido.query.order_by(Pedido.fecha_pedido.desc())
        if payload.get('rol') != 'administrador':
            query = query.filter_by(id_usuario=int(payload['sub']))
        return jsonify([p.to_dict() for p in query.all()])

    @app.patch('/pedidos/<int:pedido_id>/estado')
    def cambiar_estado(pedido_id):
        payload = token_payload()
        if not payload or payload.get('rol') != 'administrador':
            return jsonify(error='Solo un administrador puede cambiar el estado'), 403

        pedido = db.session.get(Pedido, pedido_id)
        estado = EstadoPedido.query.filter_by(
            nombre_estado=(request.get_json(silent=True) or {}).get('estado')
        ).first()
        if not pedido or not estado:
            return jsonify(error='Pedido o estado no válido'), 404

        pedido.estado = estado
        db.session.commit()
        return jsonify(pedido.to_dict())


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5003)), debug=True)
