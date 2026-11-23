"""Microservicio de pedidos: confirma compras, historial del cliente y gestión del administrador.

Los precios se piden al servicio de catálogo (y al de personalización para los
diseños) para no confiar en los valores que envía el navegador.
"""
import os
import re
from pathlib import Path
import uuid

import jwt
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from sqlalchemy import inspect, or_, text, update
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.utils import secure_filename

import estadisticas
from checkout import REGIONES, calcular_envio, opciones_checkout
from comprobantes import imagen_validada
from correo import enviar_notificaciones
from models import ComprobantePago, DetallePedido, DetallePersonalizado, EstadoPedido, HistorialEstado, Pedido, db, utc_now

SERVICIO_DIR = Path(__file__).resolve().parent
if os.getenv('CF_TESTING') != '1':
    load_dotenv(SERVICIO_DIR.parents[1] / '.env')
    load_dotenv(SERVICIO_DIR / '.env')

JWT_SECRET = os.getenv('JWT_SECRET', 'cambia-esta-clave-secreta-en-produccion')
CATALOGO_URL = os.getenv('CATALOGO_URL', 'http://127.0.0.1:5002')
PERSONALIZACION_URL = os.getenv('PERSONALIZACION_URL', 'http://127.0.0.1:5004')
USUARIOS_URL = os.getenv('USUARIOS_URL', 'http://127.0.0.1:5001')

# En orden de avance
ESTADOS = [
    ('pendiente', 'Pedido registrado. Completa la transferencia y adjunta el comprobante para revisión.'),
    ('confirmado', 'Transferencia verificada por el negocio. Tu pedido está confirmado.'),
    ('en_produccion', 'Tu pedido se está imprimiendo.'),
    ('enviado', 'Despachado o listo para entrega en Metro.'),
    ('entregado', 'Recibiste tu pedido. ¡Gracias por tu compra!'),
    ('cancelado', 'El pedido fue anulado.'),
]
ESTACIONES_METRO = {'Rojas Magallanes', 'Bellavista de La Florida'}
TELEFONO_RE = re.compile(r'^\+?[\d\s]{8,15}$')


class ErrorProductos(Exception):
    """Un producto del carrito no se puede comprar; el mensaje se muestra al cliente."""


def create_app(test_config=None):
    # Una misma base independientemente del directorio desde donde se ejecute iniciar.bat.
    app = Flask(__name__, instance_path=str(SERVICIO_DIR / 'instance'))
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///pedidos.db')
    app.config['COMPROBANTES_DIR'] = os.getenv('UPLOAD_COMPROBANTES_DIR') or os.getenv('COMPROBANTES_DIR', str(SERVICIO_DIR / 'uploads' / 'comprobantes'))
    app.config['MAX_CONTENT_LENGTH'] = 6 * 1024 * 1024
    if test_config:
        app.config.update(test_config)
    os.makedirs(app.instance_path, exist_ok=True)
    os.makedirs(app.config['COMPROBANTES_DIR'], exist_ok=True)
    db.init_app(app)

    with app.app_context():
        db.create_all()
        agregar_columnas_nuevas()
        for orden, (nombre, descripcion) in enumerate(ESTADOS):
            estado = EstadoPedido.query.filter_by(nombre_estado=nombre).first() or EstadoPedido(nombre_estado=nombre)
            estado.descripcion, estado.orden = descripcion, orden
            db.session.add(estado)
        db.session.commit()
        db.engine.dispose()  # cada worker de gunicorn abre sus propias conexiones

    register_routes(app)
    return app


def agregar_columnas_nuevas():
    """create_all no modifica tablas existentes: agrega las columnas que falten."""
    inspector = inspect(db.engine)
    with db.engine.begin() as conexion:
        for tabla in db.metadata.sorted_tables:
            if not inspector.has_table(tabla.name):
                continue
            existentes = {c['name'] for c in inspector.get_columns(tabla.name)}
            for columna in tabla.columns:
                if columna.name not in existentes:
                    tipo = columna.type.compile(dialect=db.engine.dialect)
                    conexion.execute(text(f'ALTER TABLE {tabla.name} ADD COLUMN {columna.name} {tipo}'))
        # Las columnas nuevas se rellenan sin alterar el total ni el estado de pedidos anteriores.
        conexion.execute(text("UPDATE pedido SET metodo_pago='coordinado' WHERE metodo_pago IS NULL"))
        conexion.execute(text("UPDATE pedido SET estado_pago='pendiente' WHERE estado_pago IS NULL"))
        conexion.execute(text('UPDATE pedido SET costo_envio=0 WHERE costo_envio IS NULL'))
        conexion.execute(text('UPDATE pedido SET subtotal_productos=total-costo_envio WHERE subtotal_productos IS NULL'))
        conexion.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS ix_pedido_usuario_clave ON pedido (id_usuario, clave_idempotencia)'))


def token_payload():
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None
    try:
        payload = jwt.decode(header[7:], JWT_SECRET, algorithms=['HS256'])
        if not str(payload.get('sub', '')).isdigit():
            return None
        return payload
    except jwt.PyJWTError:
        return None


def es_admin(payload):
    return bool(payload) and payload.get('rol') == 'administrador'


def error(mensaje, status=400, campos=None, **extra):
    body = {'error': mensaje}
    if campos:
        body['campos'] = campos
    return jsonify(body | extra), status


def fetch_producto(producto_id):
    response = requests.get(f'{CATALOGO_URL}/productos/{producto_id}', timeout=5)
    return response.json() if response.ok else None


def fetch_diseno(codigo):
    if not re.fullmatch(r'[0-9a-f]{32}', codigo):
        return None
    response = requests.get(f'{PERSONALIZACION_URL}/solicitudes/{codigo}/resumen', timeout=5)
    return response.json() if response.ok else None


def fetch_perfil():
    """El correo proviene del servicio de usuarios, nunca de los datos enviados por el comprador."""
    response = requests.get(f'{USUARIOS_URL}/perfil',
                            headers={'Authorization': request.headers.get('Authorization', '')}, timeout=5)
    return response.json() if response.ok else None


def validar_entrega(data, contacto=True):
    """Revisa los datos de contacto y entrega. Devuelve {campo: error}."""
    entrega = data.get('detalle_entrega') or {}
    if not isinstance(entrega, dict):
        return {'detalle_entrega': 'Formato de entrega inválido'}
    campos = {}
    if contacto and not str(data.get('nombre_cliente') or '').strip():
        campos['nombre_cliente'] = 'Ingresa tu nombre'
    telefono = str(data.get('telefono_cliente') or '').strip()
    if contacto and not telefono:
        campos['telefono_cliente'] = 'Ingresa tu teléfono'
    elif contacto and not TELEFONO_RE.fullmatch(telefono):
        campos['telefono_cliente'] = 'El teléfono no tiene un formato válido (ej: +56 9 1234 5678)'

    metodo = data.get('metodo_entrega')
    if metodo == 'blue':
        if entrega.get('region') not in {codigo for codigo, _, _ in REGIONES}:
            campos['region'] = 'Elige una región'
        if not 2 <= len(str(entrega.get('comuna') or '').strip()) <= 80:
            campos['comuna'] = 'Ingresa tu comuna (2 a 80 caracteres)'
        if contacto and not str(entrega.get('direccion') or '').strip():
            campos['direccion'] = 'Ingresa tu dirección'
    elif metodo == 'metro':
        if entrega.get('estacion') not in ESTACIONES_METRO:
            campos['estacion'] = 'Elige una estación'
    else:
        campos['metodo_entrega'] = 'Elige cómo quieres recibir tu pedido'
    return campos


def armar_detalles(items):
    """Busca el precio real de cada producto o diseño. Devuelve (detalles, personalizados)."""
    if not isinstance(items, list) or not items or len(items) > 100:
        raise ErrorProductos('El carrito debe contener entre 1 y 100 líneas de productos.')
    detalles, personalizados = [], []
    for item in items:
        if not isinstance(item, dict):
            raise ErrorProductos('Formato de productos inválido')
        cantidad_original = item.get('cantidad', 1)
        cantidad = int(cantidad_original)
        if isinstance(cantidad_original, bool) or str(cantidad_original) != str(cantidad):
            raise ErrorProductos('La cantidad debe ser un número entero.')
        if not 1 <= cantidad <= 99:
            raise ErrorProductos('La cantidad de cada producto debe estar entre 1 y 99')
        if item.get('codigo_solicitud'):
            diseno = fetch_diseno(str(item['codigo_solicitud']))
            if not diseno:
                raise ErrorProductos('Uno de los diseños personalizados no existe o no está confirmado')
            personalizados.append(DetallePersonalizado(
                codigo_solicitud=diseno['codigo'], nombre=diseno['nombre'], detalle=diseno['detalle'],
                cantidad=cantidad, precio_unitario=diseno['precio'], subtotal=diseno['precio'] * cantidad,
            ))
            continue
        producto = fetch_producto(int(item['id_producto']))
        if not producto:
            raise ErrorProductos(f'El producto {item["id_producto"]} ya no está disponible')
        detalles.append(DetallePedido(
            id_producto=producto['id'], nombre_producto=producto['nombre'], categoria=producto['categoria'],
            cantidad=cantidad, precio_unitario=producto['precio'], subtotal=producto['precio'] * cantidad,
        ))
    return detalles, personalizados


def cotizacion_pedido(data):
    detalles, personalizados = armar_detalles(data.get('items'))
    items = [d.to_dict() for d in detalles + personalizados]
    envio = calcular_envio(data.get('metodo_entrega'), data.get('detalle_entrega') or {}, sum(d.cantidad for d in detalles + personalizados))
    subtotal = sum(d.subtotal for d in detalles + personalizados)
    return ({'items': items, 'subtotal': subtotal, 'costo_envio': envio['costo'],
             'total': subtotal + envio['costo'], 'envio': envio}, detalles, personalizados)


def notificar(pedido, evento):
    try:
        pedido.notificaciones = enviar_notificaciones(pedido, evento)
    except Exception:
        # Un error de notificación nunca deshace el pedido ni la revisión ya guardados.
        pedido.notificaciones = {'negocio': 'error', 'cliente': 'error'}
    db.session.commit()


def pedido_autorizado(pedido_id, payload, solo_dueno=False):
    pedido = db.session.get(Pedido, pedido_id)
    if not pedido or (pedido.id_usuario != int(payload['sub']) and (solo_dueno or not es_admin(payload))):
        return None
    return pedido


def register_routes(app):
    @app.errorhandler(RequestEntityTooLarge)
    def archivo_demasiado_grande(_):
        return error('El comprobante debe pesar como máximo 5 MB.', 413)

    @app.get('/health')
    def health():
        return jsonify(status='ok')

    @app.get('/estados')
    def estados():
        return jsonify([e.to_dict() for e in EstadoPedido.query.order_by(EstadoPedido.orden)])

    @app.get('/checkout/opciones')
    def checkout_opciones():
        return jsonify(opciones_checkout())

    @app.post('/cotizar')
    def cotizar():
        data = request.get_json(silent=True) or {}
        if not isinstance(data, dict):
            return error('Datos de cotización inválidos')
        if campos := validar_entrega(data, contacto=False):
            return error('Revisa la entrega para simular el despacho', campos=campos)
        try:
            cotizacion, _, _ = cotizacion_pedido(data)
        except requests.RequestException:
            return error('No pudimos consultar los precios. Intenta más tarde.', 503)
        except (ErrorProductos, KeyError, TypeError, ValueError, OverflowError) as exc:
            return error(str(exc) if isinstance(exc, ErrorProductos) else 'Formato de productos inválido')
        return jsonify(cotizacion)

    # HU04.5 Confirmar compra
    @app.post('/pedidos')
    def crear_pedido():
        payload = token_payload()
        if not payload:
            return error('Inicia sesión para confirmar tu compra', 401)

        data = request.get_json(silent=True) or {}
        if not isinstance(data, dict):
            return error('Datos del pedido inválidos')
        items = data.get('items') or []
        if not items:
            return error('Tu carrito está vacío')
        if campos := validar_entrega(data):
            return error('Revisa los datos de entrega', campos=campos)
        if data.get('metodo_pago') != 'transferencia':
            return error('Elige transferencia como método de pago', campos={'metodo_pago': 'Elige transferencia'})

        clave = data.get('clave_idempotencia')
        if clave:
            try:
                clave = str(uuid.UUID(str(clave)))
            except (ValueError, TypeError, AttributeError):
                return error('La clave de confirmación es inválida. Recarga el carrito.')
            anterior = Pedido.query.filter_by(id_usuario=int(payload['sub']), clave_idempotencia=clave).first()
            if anterior:
                return jsonify(anterior.to_dict()), 200

        try:
            cotizacion, detalles, personalizados = cotizacion_pedido(data)
        except requests.RequestException:
            return error('El catálogo o el servicio de personalización no está disponible, intenta más tarde', 503)
        except ErrorProductos as e:
            return error(str(e))
        except (KeyError, TypeError, ValueError, OverflowError):
            return error('Formato de productos inválido')

        aceptado = data.get('total_aceptado')
        if type(aceptado) is not int or aceptado != cotizacion['total']:
            return error('Actualizamos el total. Revisa el resumen antes de confirmar.', 409, cotizacion=cotizacion)
        try:
            perfil = fetch_perfil()
        except (requests.RequestException, ValueError):
            return error('No pudimos verificar tu cuenta. Intenta de nuevo.', 503)
        if not isinstance(perfil, dict) or not perfil.get('correo'):
            return error('Tu sesión no se pudo verificar. Vuelve a iniciar sesión.', 401)

        entrega = data.get('detalle_entrega') or {}
        campos_entrega = ('region', 'comuna', 'direccion', 'referencia') if data['metodo_entrega'] == 'blue' else ('estacion', 'horario')
        pedido = Pedido(
            id_usuario=int(payload['sub']),
            estado=EstadoPedido.query.filter_by(nombre_estado='pendiente').first(),
            nombre_cliente=str(data['nombre_cliente']).strip()[:120],
            telefono_cliente=str(data['telefono_cliente']).strip()[:30],
            correo_cliente=perfil['correo'],
            metodo_entrega=data['metodo_entrega'],
            detalle_entrega={k: str(entrega.get(k) or '').strip()[:200] for k in campos_entrega},
            subtotal_productos=cotizacion['subtotal'],
            costo_envio=cotizacion['costo_envio'], envio=cotizacion['envio'], total=cotizacion['total'],
            metodo_pago='transferencia', estado_pago='pendiente', clave_idempotencia=clave or None,
            observacion=str(data.get('observacion') or '').strip()[:500] or None,
            detalles=detalles,
            personalizados=personalizados,
            historial=[HistorialEstado(estado='pendiente')],
        )
        db.session.add(pedido)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            anterior = Pedido.query.filter_by(id_usuario=int(payload['sub']), clave_idempotencia=clave).first() if clave else None
            if anterior:
                return jsonify(anterior.to_dict()), 200
            raise
        notificar(pedido, 'pedido_registrado')
        return jsonify(pedido.to_dict()), 201

    # HU05.1 Historial del cliente · HU05.5 Pedidos recibidos (administrador)
    @app.get('/pedidos')
    def listar_pedidos():
        payload = token_payload()
        if not payload:
            return error('Debes iniciar sesión', 401)

        query = Pedido.query.order_by(Pedido.fecha_pedido.desc())
        if es_admin(payload) and request.args.get('todos') == 'true':
            if usuario := request.args.get('usuario', type=int):
                query = query.filter(Pedido.id_usuario == usuario)
            if estado := request.args.get('estado'):
                query = query.join(EstadoPedido).filter(EstadoPedido.nombre_estado == estado)
            if busqueda := (request.args.get('q') or '').strip():
                filtros = [Pedido.nombre_cliente.ilike(f'%{busqueda}%'), Pedido.telefono_cliente.ilike(f'%{busqueda}%')]
                if busqueda.lstrip('#').isdigit():
                    filtros.append(Pedido.id_pedido == int(busqueda.lstrip('#')))
                query = query.filter(or_(*filtros))
        else:
            # Solo los pedidos del cliente que inició sesión
            query = query.filter_by(id_usuario=int(payload['sub']))
        return jsonify([p.resumen() for p in query.all()])

    # HU05.2 Detalle · HU05.3 Estado
    @app.get('/pedidos/<int:pedido_id>')
    def ver_pedido(pedido_id):
        payload = token_payload()
        if not payload:
            return error('Debes iniciar sesión', 401)
        pedido = db.session.get(Pedido, pedido_id)
        if not pedido or (not es_admin(payload) and pedido.id_usuario != int(payload['sub'])):
            return error('Pedido no encontrado', 404)
        return jsonify(pedido.to_dict())

    @app.post('/pedidos/<int:pedido_id>/comprobante')
    def subir_comprobante(pedido_id):
        payload = token_payload()
        if not payload:
            return error('Inicia sesión para adjuntar tu comprobante', 401)
        pedido = pedido_autorizado(pedido_id, payload, solo_dueno=True)
        if not pedido:
            return error('Pedido no encontrado', 404)
        if pedido.estado.nombre_estado == 'cancelado':
            return error('Este pedido está cancelado', 409)
        if pedido.metodo_pago != 'transferencia':
            return error('Este pedido anterior coordina su pago directamente con el negocio', 409)
        if pedido.estado_pago in ('en_revision', 'aprobado'):
            return error('Tu comprobante ya está en revisión o el pago ya fue aprobado', 409)
        archivo = request.files.get('archivo')
        try:
            contenido, extension, mime = imagen_validada(archivo)
        except ValueError as exc:
            return error(str(exc))
        finally:
            if archivo:
                archivo.close()
        # Reserva atómica: dos clics simultáneos no crean dos comprobantes pendientes.
        reservado = db.session.execute(update(Pedido).where(
            Pedido.id_pedido == pedido_id, Pedido.estado_pago.in_(('pendiente', 'rechazado')),
            Pedido.id_estado_pedido == pedido.id_estado_pedido,
        ).values(estado_pago='en_revision')).rowcount
        if reservado != 1:
            db.session.rollback()
            return error('El pedido cambió mientras adjuntabas el comprobante. Actualiza la página.', 409)
        nombre = secure_filename(archivo.filename)[:240] or f'comprobante.{extension}'
        archivo_privado = f'{uuid.uuid4().hex}.{extension}'
        ruta = Path(app.config['COMPROBANTES_DIR']) / archivo_privado
        ruta.write_bytes(contenido)
        comprobante = ComprobantePago(
            nombre_original=nombre, archivo=archivo_privado, mime=mime, estado='en_revision',
            referencia_transferencia=str(request.form.get('referencia_transferencia') or '').strip()[:120] or None,
        )
        pedido.comprobantes.append(comprobante)
        pedido.estado_pago = 'en_revision'
        pedido.observacion_pago = 'Comprobante recibido. El negocio verificará la transferencia antes de aprobar el pago.'
        pedido.fecha_pago = utc_now()
        pedido.historial.append(HistorialEstado(estado=pedido.estado.nombre_estado, comentario='Comprobante recibido para revisión de pago.'))
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            ruta.unlink(missing_ok=True)
            raise
        notificar(pedido, 'comprobante_recibido')
        return jsonify(pedido.to_dict()), 201

    @app.get('/pedidos/<int:pedido_id>/comprobantes/<int:comprobante_id>')
    def ver_comprobante(pedido_id, comprobante_id):
        payload = token_payload()
        if not payload:
            return error('Debes iniciar sesión', 401)
        pedido = pedido_autorizado(pedido_id, payload)
        if not pedido:
            return error('Comprobante no encontrado', 404)
        comprobante = ComprobantePago.query.filter_by(id_pedido=pedido_id, id_comprobante=comprobante_id).first()
        if not comprobante:
            return error('Comprobante no encontrado', 404)
        response = send_from_directory(app.config['COMPROBANTES_DIR'], comprobante.archivo, mimetype=comprobante.mime)
        response.headers['Cache-Control'] = 'private, no-store, max-age=0'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Content-Disposition'] = 'inline'
        return response

    @app.patch('/pedidos/<int:pedido_id>/pago')
    def revisar_pago(pedido_id):
        payload = token_payload()
        if not es_admin(payload):
            return error('Solo un administrador puede revisar el pago', 403)
        pedido = db.session.get(Pedido, pedido_id)
        if not pedido:
            return error('Pedido no encontrado', 404)
        if pedido.estado.nombre_estado == 'cancelado':
            return error('No puedes aprobar pagos de un pedido cancelado', 409)
        data = request.get_json(silent=True) or {}
        if not isinstance(data, dict) or data.get('estado') not in ('aprobado', 'rechazado'):
            return error('Elige aprobar o rechazar el pago')
        if pedido.metodo_pago != 'transferencia' or pedido.estado_pago != 'en_revision' or not pedido.comprobantes:
            return error('No hay un comprobante pendiente de revisión', 409)
        comprobante = pedido.comprobantes[-1]
        if comprobante.estado != 'en_revision':
            return error('Este comprobante ya fue revisado', 409)
        estado = data['estado']
        observacion = str(data.get('observacion') or '').strip()[:500]
        if not observacion:
            observacion = ('Transferencia verificada por el negocio.' if estado == 'aprobado'
                           else 'No pudimos verificar la transferencia. Revisa los datos y adjunta un nuevo comprobante.')
        # Compara y actualiza dentro de la transacción: una revisión tiene una única decisión.
        reservado = db.session.execute(update(Pedido).where(
            Pedido.id_pedido == pedido_id, Pedido.estado_pago == 'en_revision',
            Pedido.id_estado_pedido == pedido.id_estado_pedido,
        ).values(estado_pago=estado)).rowcount
        if reservado != 1:
            db.session.rollback()
            return error('El pago o el estado del pedido ya cambiaron. Actualiza la página.', 409)
        revisado = db.session.execute(update(ComprobantePago).where(
            ComprobantePago.id_comprobante == comprobante.id_comprobante,
            ComprobantePago.estado == 'en_revision',
        ).values(estado=estado)).rowcount
        if revisado != 1:
            db.session.rollback()
            return error('Este comprobante ya fue revisado', 409)
        comprobante.estado = estado
        comprobante.observacion = observacion
        comprobante.revisado_por = int(payload['sub'])
        comprobante.fecha_revision = utc_now()
        pedido.estado_pago = estado
        pedido.observacion_pago = observacion
        pedido.fecha_pago = comprobante.fecha_revision
        if estado == 'aprobado' and pedido.estado.nombre_estado == 'pendiente':
            pedido.estado = EstadoPedido.query.filter_by(nombre_estado='confirmado').first()
        pedido.historial.append(HistorialEstado(estado=pedido.estado.nombre_estado,
                                               comentario=f'Pago {estado}: {observacion}'[:300]))
        db.session.commit()
        notificar(pedido, 'pago_aprobado' if estado == 'aprobado' else 'pago_rechazado')
        return jsonify(pedido.to_dict())

    # Pedidos donde se compró un diseño de "Crea desde cero" (para gestionar la solicitud)
    @app.get('/pedidos/por-solicitud/<codigo>')
    def pedidos_por_solicitud(codigo):
        if not es_admin(token_payload()):
            return error('Solo un administrador puede ver esta información', 403)
        pedidos = (Pedido.query.join(DetallePersonalizado)
                   .filter(DetallePersonalizado.codigo_solicitud == codigo).order_by(Pedido.id_pedido).all())
        return jsonify([p.resumen() for p in pedidos])

    # HU05.4 Actualizar estado (administrador)
    @app.patch('/pedidos/<int:pedido_id>/estado')
    def cambiar_estado(pedido_id):
        if not es_admin(token_payload()):
            return error('Solo un administrador puede cambiar el estado', 403)

        data = request.get_json(silent=True) or {}
        if not isinstance(data, dict):
            return error('Datos de estado inválidos')
        pedido = db.session.get(Pedido, pedido_id)
        if not pedido:
            return error('Pedido no encontrado', 404)
        estado = EstadoPedido.query.filter_by(nombre_estado=data.get('estado')).first()
        if not estado:
            return error('Estado no válido')
        if (pedido.metodo_pago == 'transferencia' and pedido.estado_pago != 'aprobado'
                and estado.nombre_estado not in ('pendiente', 'cancelado')):
            return error('Primero revisa y aprueba la transferencia del cliente', 409)
        tracking = str(data.get('codigo_seguimiento') or '').strip()[:100]
        if estado.id_estado_pedido == pedido.id_estado_pedido and tracking == (pedido.codigo_seguimiento or ''):
            return error('El pedido ya está en ese estado')

        pedido.estado = estado
        if tracking:
            pedido.codigo_seguimiento = tracking
        pedido.historial.append(HistorialEstado(
            estado=estado.nombre_estado, comentario=str(data.get('comentario') or '').strip()[:300] or None))
        db.session.commit()
        notificar(pedido, 'estado_actualizado')
        return jsonify(pedido.to_dict())

    # Dashboard del administrador
    @app.get('/estadisticas')
    def ver_estadisticas():
        if not es_admin(token_payload()):
            return error('Solo un administrador puede ver las estadísticas', 403)
        meses = min(max(request.args.get('meses', 6, type=int), 2), 12)
        return jsonify(estadisticas.calcular(meses))


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5003)), debug=True)
