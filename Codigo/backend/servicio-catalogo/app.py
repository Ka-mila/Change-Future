"""Microservicio de catálogo: categorías y productos.

El público solo ve los productos activos. El administrador puede crear,
modificar y deshabilitar productos (nunca se borran: los pedidos antiguos
siguen mostrando su nombre y precio).
"""
import os
import uuid

import jwt
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import RequestEntityTooLarge

from models import Categoria, Producto, db
from seed import seed_catalogo

JWT_SECRET = os.getenv('JWT_SECRET', 'cambia-esta-clave-secreta-en-produccion')
UPLOAD_DIR = os.getenv('UPLOAD_DIR', os.path.join(os.path.dirname(__file__), 'uploads'))
IMAGENES_DIR = os.path.join(UPLOAD_DIR, 'productos')
# Ruta pública de las imágenes subidas (a través del gateway)
URL_IMAGENES = os.getenv('URL_IMAGENES', '/api/catalogo/imagenes')
IMAGEN_POR_DEFECTO = '/assets/images/product-placeholder.svg'

MAX_IMAGEN_MB = 5
FORMATOS = {'jpg': b'\xff\xd8\xff', 'jpeg': b'\xff\xd8\xff', 'png': b'\x89PNG', 'webp': b'RIFF'}
PERSONALIZACION = ['Disponible', 'Personalizable', 'A medida', 'No disponible']


def create_app():
    app = Flask(__name__, instance_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance'))
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///catalogo.db')
    app.config['MAX_CONTENT_LENGTH'] = (MAX_IMAGEN_MB + 1) * 1024 * 1024
    os.makedirs(IMAGENES_DIR, exist_ok=True)
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


def error(mensaje, status=400, campos=None):
    body = {'error': mensaje}
    if campos:
        body['campos'] = campos
    return jsonify(body), status


def leer_datos():
    """Acepta JSON o multipart (cuando viene una imagen)."""
    return request.form.to_dict() if request.form else (request.get_json(silent=True) or {})


def validar_producto(data, parcial=False):
    """Devuelve ({campo: error}, {campo: valor limpio}). Con parcial=True solo revisa lo que viene."""
    errores, limpio = {}, {}

    def presente(campo):
        return not parcial or campo in data

    for campo, etiqueta, maximo in (('nombre', 'El nombre', 120), ('descripcion', 'La descripción', 1000),
                                    ('categoria', 'La categoría', 60)):
        if presente(campo):
            valor = str(data.get(campo) or '').strip()
            if not valor:
                errores[campo] = f'{etiqueta} es obligatoria' if campo != 'nombre' else 'El nombre es obligatorio'
            elif len(valor) > maximo:
                errores[campo] = f'{etiqueta} no puede superar {maximo} caracteres'
            limpio[campo] = valor

    for campo, etiqueta, minimo in (('precio', 'El precio', 1), ('stock', 'El stock', 0)):
        if presente(campo) and (campo == 'precio' or data.get(campo) not in (None, '')):
            try:
                valor = int(str(data.get(campo)).replace('.', '').strip())
                if valor < minimo or valor > 10_000_000:
                    raise ValueError
                limpio[campo] = valor
            except (TypeError, ValueError):
                errores[campo] = f'{etiqueta} debe ser un número entero{" mayor que 0" if minimo else " (0 o más)"}'

    if presente('material'):
        limpio['material'] = str(data.get('material') or 'PLA').strip()[:40] or 'PLA'
    if presente('personalizacion'):
        valor = data.get('personalizacion') or 'Disponible'
        if valor not in PERSONALIZACION:
            errores['personalizacion'] = 'Elige una opción de personalización'
        limpio['personalizacion'] = valor
    if presente('destacado'):
        limpio['destacado'] = str(data.get('destacado')).lower() in ('true', '1', 'on', 'si')
    return errores, limpio


def guardar_imagen(archivo):
    """Devuelve la URL pública de la imagen o lanza ValueError con el motivo."""
    extension = archivo.filename.rsplit('.', 1)[-1].lower() if '.' in archivo.filename else ''
    datos = archivo.read()
    if extension not in FORMATOS or not datos.startswith(FORMATOS[extension]):
        raise ValueError('Formato no permitido. Usa una imagen JPG, PNG o WEBP.')
    if len(datos) > MAX_IMAGEN_MB * 1024 * 1024:
        raise ValueError(f'La imagen pesa más de {MAX_IMAGEN_MB} MB.')
    nombre = f'{uuid.uuid4().hex}.{extension}'
    with open(os.path.join(IMAGENES_DIR, nombre), 'wb') as f:
        f.write(datos)
    return f'{URL_IMAGENES}/{nombre}'


def aplicar(producto, limpio):
    """Copia los datos validados al producto. Si la categoría no existe, la crea."""
    if 'categoria' in limpio:
        nombre = limpio.pop('categoria')
        categoria = Categoria.query.filter(db.func.lower(Categoria.nombre) == nombre.lower()).first()
        producto.categoria = categoria or Categoria(nombre=nombre)
    columnas = {'precio': 'precio_base'}
    for clave, valor in limpio.items():
        setattr(producto, columnas.get(clave, clave), valor)


def register_routes(app):
    @app.errorhandler(RequestEntityTooLarge)
    def demasiado_grande(_):
        return error(f'La imagen pesa más de {MAX_IMAGEN_MB} MB.', 413, {'imagen': f'La imagen pesa más de {MAX_IMAGEN_MB} MB.'})

    @app.get('/health')
    def health():
        return jsonify(status='ok')

    @app.get('/categorias')
    def categorias():
        # Solo categorías que tienen productos a la venta
        rows = (Categoria.query.join(Producto).filter(Categoria.estado == 'activo', Producto.estado == 'activo')
                .distinct().order_by(Categoria.nombre).all())
        return jsonify([c.to_dict() for c in rows])

    @app.get('/productos')
    def productos():
        query = Producto.query.join(Categoria)
        # El administrador puede pedir también los deshabilitados
        if not (request.args.get('incluir_inactivos') == 'true' and is_admin()):
            query = query.filter(Producto.estado == 'activo')

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
        # Un producto deshabilitado no se puede ver ni comprar (el pedido valida con esta ruta)
        if not p or (p.estado != 'activo' and not is_admin()):
            return error('Producto no encontrado', 404)
        return jsonify(p.to_dict())

    @app.get('/imagenes/<path:nombre>')
    def imagen(nombre):
        return send_from_directory(IMAGENES_DIR, nombre, max_age=86400)

    # HU06.1 Agregar producto
    @app.post('/productos')
    def crear_producto():
        if not is_admin():
            return error('Solo un administrador puede crear productos', 403)

        errores, limpio = validar_producto(leer_datos())
        imagen = request.files.get('imagen')
        url_imagen = IMAGEN_POR_DEFECTO
        if imagen and imagen.filename:
            try:
                url_imagen = guardar_imagen(imagen)
            except ValueError as e:
                errores['imagen'] = str(e)
        if errores:
            return error('Revisa los datos del producto', campos=errores)

        p = Producto(imagen_principal=url_imagen, stock=limpio.pop('stock', 0))
        aplicar(p, limpio)
        db.session.add(p)
        db.session.commit()
        return jsonify(p.to_dict()), 201

    # HU06.2 Modificar producto
    @app.put('/productos/<int:producto_id>')
    def modificar_producto(producto_id):
        if not is_admin():
            return error('Solo un administrador puede modificar productos', 403)
        p = db.session.get(Producto, producto_id)
        if not p:
            return error('Producto no encontrado', 404)

        errores, limpio = validar_producto(leer_datos(), parcial=True)
        imagen = request.files.get('imagen')
        if imagen and imagen.filename:
            try:
                limpio['imagen_principal'] = guardar_imagen(imagen)
            except ValueError as e:
                errores['imagen'] = str(e)
        if errores:
            return error('Revisa los datos del producto', campos=errores)

        aplicar(p, limpio)
        db.session.commit()
        return jsonify(p.to_dict())

    # HU06.3 Deshabilitar (o volver a habilitar) un producto
    @app.patch('/productos/<int:producto_id>/estado')
    def cambiar_estado(producto_id):
        if not is_admin():
            return error('Solo un administrador puede deshabilitar productos', 403)
        p = db.session.get(Producto, producto_id)
        if not p:
            return error('Producto no encontrado', 404)
        activo = (request.get_json(silent=True) or {}).get('activo')
        if not isinstance(activo, bool):
            return error('Indica si el producto queda activo (true) o deshabilitado (false)')
        p.estado = 'activo' if activo else 'inactivo'
        db.session.commit()
        return jsonify(p.to_dict())


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5002)), debug=True)
