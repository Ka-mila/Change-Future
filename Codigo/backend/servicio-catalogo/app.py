"""Microservicio de catálogo: categorías y productos."""
import os

import jwt
from flask import Flask, jsonify, request

from models import Categoria, Producto, db
from seed import seed_catalogo

JWT_SECRET = os.getenv('JWT_SECRET', 'cambia-esta-clave-en-produccion')


def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///catalogo.db')
    db.init_app(app)

    with app.app_context():
        db.create_all()
        seed_catalogo()
        db.engine.dispose()  # cada worker de gunicorn abre sus propias conexiones

    register_routes(app)
    return app


def is_admin():
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return False
    try:
        payload = jwt.decode(header[7:], JWT_SECRET, algorithms=['HS256'])
    except jwt.PyJWTError:
        return False
    return payload.get('rol') == 'administrador'


def register_routes(app):
    @app.get('/health')
    def health():
        return jsonify(status='ok')

    @app.get('/categorias')
    def categorias():
        rows = Categoria.query.filter_by(estado='activo').order_by(Categoria.nombre).all()
        return jsonify([c.to_dict() for c in rows])

    @app.get('/productos')
    def productos():
        query = Producto.query.join(Categoria).filter(Producto.estado == 'activo')

        if categoria := request.args.get('categoria'):
            query = query.filter(Categoria.nombre == categoria)
        if texto := request.args.get('q'):
            like = f'%{texto}%'
            query = query.filter(db.or_(
                Producto.nombre.ilike(like),
                Producto.descripcion.ilike(like),
                Categoria.nombre.ilike(like),
            ))
        if request.args.get('destacados') == 'true':
            query = query.filter(Producto.destacado.is_(True))

        orden = {
            'price-low': Producto.precio_base.asc(),
            'price-high': Producto.precio_base.desc(),
            'name': Producto.nombre.asc(),
        }.get(request.args.get('orden'), Producto.id_producto.asc())

        return jsonify([p.to_dict() for p in query.order_by(orden).all()])

    @app.get('/productos/<int:producto_id>')
    def producto(producto_id):
        p = db.session.get(Producto, producto_id)
        if not p or p.estado != 'activo':
            return jsonify(error='Producto no encontrado'), 404
        return jsonify(p.to_dict())

    @app.post('/productos')
    def crear_producto():
        if not is_admin():
            return jsonify(error='Solo un administrador puede crear productos'), 403

        data = request.get_json(silent=True) or {}
        if not data.get('nombre') or not data.get('categoria') or not data.get('precio'):
            return jsonify(error='nombre, categoria y precio son obligatorios'), 400

        categoria = Categoria.query.filter_by(nombre=data['categoria']).first()
        if not categoria:
            categoria = Categoria(nombre=data['categoria'])
            db.session.add(categoria)

        p = Producto(
            nombre=data['nombre'],
            categoria=categoria,
            precio_base=int(data['precio']),
            descripcion=data.get('descripcion'),
            material=data.get('material', 'PLA'),
            personalizacion=data.get('personalizacion', 'Disponible'),
            imagen_principal=data.get('imagen', '/assets/images/product-placeholder.svg'),
            stock=int(data.get('stock', 0)),
        )
        db.session.add(p)
        db.session.commit()
        return jsonify(p.to_dict()), 201


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5002)), debug=True)
