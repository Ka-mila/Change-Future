"""Microservicio de personalización: solicitudes "Crea desde cero" y sus propuestas 3D.

Flujo:
1. POST /solicitudes con la imagen de referencia -> se guarda y se envía al
   servicio de procesamiento, que devuelve la propuesta 3D (STL).
2. PATCH /solicitudes/<codigo> con el color y el tamaño elegidos.
3. POST /solicitudes/<codigo>/confirmar -> queda lista para el carrito.
"""
import os
import uuid
import io 
import struct 
import jwt
import requests

from flask import Flask, jsonify, request, send_file, send_from_directory 
from sqlalchemy import inspect, text
from werkzeug.exceptions import RequestEntityTooLarge

from models import Color, PropuestaDiseno, SolicitudPersonalizacion, Tamano, db
from seed import seed_opciones

JWT_SECRET = os.getenv('JWT_SECRET', 'cambia-esta-clave-secreta-en-produccion')
PROCESAMIENTO_URL = os.getenv('PROCESAMIENTO_URL', 'http://127.0.0.1:5005')
UPLOAD_DIR = os.getenv('UPLOAD_DIR', os.path.join(os.path.dirname(__file__), 'uploads'))
REFERENCIAS_DIR = os.path.join(UPLOAD_DIR, 'referencias')
PROPUESTAS_DIR = os.path.join(UPLOAD_DIR, 'propuestas')

MAX_IMAGEN_MB = 10
FORMATOS = {  # extensión -> cómo empiezan los bytes del archivo
    'jpg': (b'\xff\xd8\xff',),
    'jpeg': (b'\xff\xd8\xff',),
    'png': (b'\x89PNG',),
    'webp': (b'RIFF',),
}
# Estados que maneja el administrador después de que el cliente confirma
ESTADOS_SOLICITUD = {
    'borrador': 'El cliente aún no confirma su diseño',
    'confirmada': 'El cliente confirmó el diseño; falta revisarlo',
    'en_revision': 'Un diseñador está revisando la propuesta',
    'aprobada': 'Lista para imprimir',
    'en_produccion': 'Se está imprimiendo',
    'completada': 'Pieza terminada',
    'rechazada': 'No se puede fabricar así; se contactará al cliente',
    'recibida': 'Solicitud del formulario anterior',
}
ESTILOS = {
    'silueta': 'Recorta la figura y la convierte en una pieza plana (llaveros, placas, figuras).',
    'relieve': 'Las zonas claras quedan en alto y las oscuras en bajo (cuadros y placas con fotos).',
}
def escalar_stl(datos, medida_mm):
    factor = medida_mm / 100.0
    if factor <= 0:
        raise ValueError('El tamaño seleccionado no es válido.')

    copia = bytearray(datos)
    if len(copia) < 84:
        raise ValueError('El archivo STL está incompleto.')

    cantidad = struct.unpack_from('<I', copia, 80)[0]
    if cantidad == 0 or len(copia) != 84 + cantidad * 50:
        raise ValueError('El archivo STL no tiene el formato esperado.')

    for indice in range(cantidad):
        inicio = 84 + indice * 50
        valores = list(struct.unpack_from('<12f', copia, inicio))

        # Ajustar la orientación de las caras.
        valores[0] /= factor
        valores[1] /= factor
        longitud = sum(v * v for v in valores[:3]) ** 0.5
        if longitud:
            valores[:3] = [v / longitud for v in valores[:3]]

        # Cambiar ancho y alto, conservando el grosor.
        for posicion in (3, 4, 6, 7, 9, 10):
            valores[posicion] *= factor

        struct.pack_into('<12f', copia, inicio, *valores)

    return io.BytesIO(copia)

def create_app():
    app = Flask(
        __name__,
        instance_path=os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            'instance'
        )
    )
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///personalizacion.db')
    app.config['MAX_CONTENT_LENGTH'] = (MAX_IMAGEN_MB + 1) * 1024 * 1024 
    os.makedirs(REFERENCIAS_DIR, exist_ok=True)
    os.makedirs(PROPUESTAS_DIR, exist_ok=True)
    db.init_app(app)

    with app.app_context():
        db.create_all()
        agregar_columnas_nuevas()
        seed_opciones()
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
        conexion.execute(text(
            'CREATE UNIQUE INDEX IF NOT EXISTS ix_solicitud_codigo ON solicitud_personalizacion (codigo)'))


def token_payload():
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None
    try:
        return jwt.decode(header[7:], JWT_SECRET, algorithms=['HS256'])
    except jwt.PyJWTError:
        return None


def error(mensaje, status=400, **extra):
    return jsonify(error=mensaje, **extra), status


def validar_imagen(archivo):
    """Devuelve (extensión, bytes) o lanza ValueError con un mensaje para el cliente."""
    if not archivo or not archivo.filename:
        raise ValueError('Selecciona una imagen de referencia.')
    extension = archivo.filename.rsplit('.', 1)[-1].lower() if '.' in archivo.filename else ''
    datos = archivo.read()
    if extension not in FORMATOS or not datos.startswith(FORMATOS[extension]):
        raise ValueError('Formato no permitido. Usa una imagen JPG, PNG o WEBP.')
    if len(datos) > MAX_IMAGEN_MB * 1024 * 1024:
        raise ValueError(f'La imagen pesa más de {MAX_IMAGEN_MB} MB. Usa una más liviana.')
    return extension, datos


def generar_propuesta(solicitud, estilo):
    """Envía la imagen al servicio de procesamiento y guarda la propuesta. Devuelve un mensaje de error o None."""
    with open(os.path.join(REFERENCIAS_DIR, solicitud.imagen_referencia), 'rb') as f:
        imagen = f.read()
    try:
        respuesta = requests.post(
            f'{PROCESAMIENTO_URL}/procesar',
            data={'estilo': estilo},
            files={'imagen': (solicitud.imagen_referencia, imagen)},
            timeout=60,
        )
    except requests.RequestException:
        return 'El servicio de procesamiento no está disponible. Intenta de nuevo en unos minutos.', 503

    if not respuesta.ok:
        try:
            mensaje = respuesta.json().get('error')
        except ValueError:
            mensaje = None
        return mensaje or 'Ocurrió un error al generar la propuesta. Intenta de nuevo.', 422

    archivo = f'{solicitud.codigo}_{uuid.uuid4().hex[:8]}.stl'
    with open(os.path.join(PROPUESTAS_DIR, archivo), 'wb') as f:
        f.write(respuesta.content)
    db.session.add(PropuestaDiseno(
        solicitud=solicitud,
        estilo=estilo,
        archivo_propuesta=archivo,
        ancho_mm=float(respuesta.headers.get('X-ancho-mm', 0)),
        alto_mm=float(respuesta.headers.get('X-alto-mm', 0)),
        profundidad_mm=float(respuesta.headers.get('X-profundidad-mm', 0)),
    ))
    solicitud.estilo = estilo
    db.session.commit()
    return None


def buscar(codigo):
    return SolicitudPersonalizacion.query.filter_by(codigo=codigo).first()


def register_routes(app):
    @app.errorhandler(RequestEntityTooLarge)
    def demasiado_grande(_):
        return error(f'La imagen pesa más de {MAX_IMAGEN_MB} MB. Usa una más liviana.', 413)

    @app.get('/health')
    def health():
        return jsonify(status='ok')

    @app.get('/opciones')
    def opciones():
        return jsonify(
            colores=[c.to_dict() for c in Color.query.filter_by(estado='activo').order_by(Color.id_color)],
            tamanos=[t.to_dict() for t in Tamano.query.filter_by(estado='activo').order_by(Tamano.medida_mm)],
            estilos=[{'id': clave, 'descripcion': texto} for clave, texto in ESTILOS.items()],
            formatos=sorted(FORMATOS),
            max_mb=MAX_IMAGEN_MB,
        )

    # Cargar imagen + generar la primera propuesta
    @app.post('/solicitudes')
    def crear_solicitud():
        form = request.form
        estilo = form.get('estilo', 'silueta')
        if not form.get('tipo'):
            return error('Elige qué quieres crear.')
        if estilo not in ESTILOS:
            return error('Estilo no válido.')
        try:
            extension, datos = validar_imagen(request.files.get('imagen'))
        except ValueError as e:
            return error(str(e))

        codigo = uuid.uuid4().hex
        nombre_archivo = f'{codigo}.{extension}'
        with open(os.path.join(REFERENCIAS_DIR, nombre_archivo), 'wb') as f:
            f.write(datos)

        payload = token_payload()
        solicitud = SolicitudPersonalizacion(
            codigo=codigo,
            id_usuario=int(payload['sub']) if payload else None,
            tipo=form['tipo'][:60],
            descripcion=(form.get('descripcion') or '').strip()[:2000],
            imagen_referencia=nombre_archivo,
            estado='borrador',
        )
        db.session.add(solicitud)
        db.session.commit()

        if fallo := generar_propuesta(solicitud, estilo):
            mensaje, status = fallo
            # La imagen queda guardada: se puede reintentar con /propuestas sin volver a subirla.
            return error(mensaje, status, codigo=codigo)
        return jsonify(solicitud.to_dict()), 201

    # Volver a generar la propuesta (por ejemplo, con el otro estilo)
    @app.post('/solicitudes/<codigo>/propuestas')
    def nueva_propuesta(codigo):
        solicitud = buscar(codigo)
        if not solicitud:
            return error('Solicitud no encontrada', 404)
        if solicitud.estado != 'borrador':
            return error('La solicitud ya fue confirmada.', 409)
        estilo = (request.get_json(silent=True) or {}).get('estilo')
        if estilo not in ESTILOS:
            return error('Estilo no válido.')
        if fallo := generar_propuesta(solicitud, estilo):
            return error(*fallo, codigo=codigo)
        return jsonify(solicitud.to_dict()), 201

    @app.get('/solicitudes/<codigo>')
    def ver_solicitud(codigo):
        solicitud = buscar(codigo)
        if not solicitud:
            return error('Solicitud no encontrada', 404)
        payload = token_payload()
        es_admin = payload and payload.get('rol') == 'administrador'
        return jsonify(solicitud.admin_dict() if es_admin else solicitud.to_dict())

    # Seleccionar color y tamaño
    @app.patch('/solicitudes/<codigo>')
    def actualizar_solicitud(codigo):
        solicitud = buscar(codigo)
        if not solicitud:
            return error('Solicitud no encontrada', 404)
        if solicitud.estado != 'borrador':
            return error('La solicitud ya fue confirmada.', 409)

        data = request.get_json(silent=True) or {}
        if 'id_color' in data:
            color = db.session.get(Color, data['id_color']) if data['id_color'] else None
            if data['id_color'] and not color:
                return error('Color no disponible.')
            solicitud.color = color
        if 'id_tamano' in data:
            tamano = db.session.get(Tamano, data['id_tamano']) if data['id_tamano'] else None
            if data['id_tamano'] and not tamano:
                return error('Tamaño no disponible.')
            solicitud.tamano_elegido = tamano
        if 'descripcion' in data:
            solicitud.descripcion = (data['descripcion'] or '').strip()[:2000]
        db.session.commit()
        return jsonify(solicitud.to_dict())

    # Confirmar la configuración antes de agregarla al carrito
    @app.post('/solicitudes/<codigo>/confirmar')
    def confirmar(codigo):
        solicitud = buscar(codigo)
        if not solicitud:
            return error('Solicitud no encontrada', 404)
        faltan = [nombre for nombre, valor in (
            ('la propuesta 3D', solicitud.propuesta), ('el color', solicitud.color), ('el tamaño', solicitud.tamano_elegido),
        ) if not valor]
        if faltan:
            return error(f'Falta elegir {", ".join(faltan)}.')

        solicitud.estado = 'confirmada'
        solicitud.propuesta.estado_aprobacion = 'aprobada'
        db.session.commit()
        return jsonify(solicitud.to_dict())

    @app.get('/solicitudes/<codigo>/modelo')
    def modelo(codigo):
        solicitud = buscar(codigo)
        if not solicitud or not solicitud.propuesta:
            return error('Propuesta no encontrada', 404)
        if request.args.get('descargar') == '1':
            if not solicitud.tamano_elegido:
                return error('Elige un tamaño antes de descargar.', 400)

            medida = solicitud.tamano_elegido.medida_mm
            ruta = os.path.join(
                PROPUESTAS_DIR,
                solicitud.propuesta.archivo_propuesta
            )

            try:
                with open(ruta, 'rb') as archivo:
                    contenido = escalar_stl(archivo.read(), medida)
            except (OSError, ValueError):
                app.logger.exception('No se pudo preparar el STL')
                return error(
                    'No se pudo preparar el archivo para imprimir.',
                    500
                )

            return send_file(
                contenido,
                mimetype='model/stl',
                as_attachment=True,
                download_name=f'change-future-{codigo[:8]}-{medida}mm.stl',
                max_age=0,
                etag=False,
            )
        return send_from_directory(
            PROPUESTAS_DIR, solicitud.propuesta.archivo_propuesta,
            mimetype='model/stl', as_attachment=False,
            download_name=f'change-future-{codigo[:8]}.stl',
        )

    # Lo usa el servicio de pedidos para validar el precio de un diseño en el carrito
    @app.get('/solicitudes/<codigo>/resumen')
    def resumen(codigo):
        solicitud = buscar(codigo)
        # Se puede comprar desde que el cliente lo confirma, aunque el administrador ya lo esté revisando
        if not solicitud or solicitud.estado in ('borrador', 'rechazada', 'recibida') or not solicitud.tamano_elegido:
            return error('El diseño no existe o no está confirmado', 404)
        return jsonify(codigo=solicitud.codigo, nombre=solicitud.nombre_item,
                       detalle=solicitud.detalle_item, precio=solicitud.tamano_elegido.precio_referencial)

    @app.get('/solicitudes')
    def listar_solicitudes():
        payload = token_payload()
        if not payload:
            return error('Debes iniciar sesión', 401)

        query = SolicitudPersonalizacion.query.order_by(SolicitudPersonalizacion.fecha_solicitud.desc())
        if payload.get('rol') != 'administrador':
            return jsonify([s.to_dict() for s in query.filter_by(id_usuario=int(payload['sub']))])

        # HU06.5: el administrador ve todas, con filtro por estado. Los borradores solo si los pide.
        estado = request.args.get('estado')
        if estado:
            query = query.filter_by(estado=estado)
        else:
            query = query.filter(SolicitudPersonalizacion.estado != 'borrador')
        return jsonify([s.admin_dict() for s in query.all()])

    @app.get('/estados-solicitud')
    def estados_solicitud():
        return jsonify([{'id': clave, 'descripcion': texto} for clave, texto in ESTADOS_SOLICITUD.items()])

    @app.patch('/solicitudes/<codigo>/estado')
    def cambiar_estado_solicitud(codigo):
        payload = token_payload()
        if not payload or payload.get('rol') != 'administrador':
            return error('Solo un administrador puede cambiar el estado de una solicitud', 403)
        solicitud = buscar(codigo)
        if not solicitud:
            return error('Solicitud no encontrada', 404)

        data = request.get_json(silent=True) or {}
        estado = data.get('estado')
        if estado not in ESTADOS_SOLICITUD or estado in ('borrador', 'recibida'):
            return error('Estado no válido')
        if solicitud.estado == 'borrador':
            return error('El cliente todavía no confirma este diseño')

        solicitud.estado = estado
        if solicitud.propuesta:
            if observaciones := (data.get('observaciones') or '').strip()[:1000]:
                solicitud.propuesta.observaciones = observaciones
            if estado == 'rechazada':
                solicitud.propuesta.estado_aprobacion = 'rechazada'
            elif estado in ('aprobada', 'en_produccion', 'completada'):
                solicitud.propuesta.estado_aprobacion = 'aprobada'
        db.session.commit()
        return jsonify(solicitud.admin_dict())

    @app.get('/referencias/<path:filename>')
    def referencia(filename):
        payload = token_payload()
        if not payload or payload.get('rol') != 'administrador':
            return error('Solo un administrador puede ver las referencias', 403)
        # Las solicitudes del formulario anterior guardaban la imagen directo en UPLOAD_DIR
        carpeta = REFERENCIAS_DIR if os.path.exists(os.path.join(REFERENCIAS_DIR, filename)) else UPLOAD_DIR
        return send_from_directory(carpeta, filename)


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5004)), debug=True)
