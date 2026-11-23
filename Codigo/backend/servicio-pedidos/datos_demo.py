"""Crea pedidos de ejemplo de los últimos 6 meses para mostrar el dashboard.

Uso (desde la carpeta servicio-pedidos):
    python datos_demo.py          crea 80 pedidos de ejemplo
    python datos_demo.py --borrar elimina solo los pedidos de ejemplo

Los pedidos de ejemplo se marcan con la observación [DEMO] y no pertenecen a ningún cliente.
"""
import random
import sys
from datetime import timedelta

from app import app
from models import (CATEGORIA_DISENO, DetallePedido, DetallePersonalizado, EstadoPedido, HistorialEstado,
                    Pedido, db, utc_now)

MARCA = '[DEMO]'
# Mismos productos que el catálogo inicial: (id, nombre, categoría, precio, popularidad)
PRODUCTOS = [
    (1, 'Figura personalizada', 'Figuras 3D', 12990, 3),
    (2, 'Decoración personalizada', 'Decoración', 8990, 4),
    (3, 'Accesorio Gaming', 'Gaming', 6990, 5),
    (4, 'Accesorio para vehículo', 'Automotriz', 9990, 1),
    (5, 'Macetero geométrico', 'Maceteros', 7990, 4),
    (6, 'Llavero personalizado', 'Llaveros', 3990, 8),
    (7, 'Soporte para celular', 'Soportes', 5990, 5),
    (8, 'Organizador de escritorio', 'Organizadores', 12990, 2),
]
DISENOS = [('Silueta · Morado · Pequeño (5 cm)', 5990), ('Relieve · Blanco · Mediano (10 cm)', 9990),
           ('Silueta · Negro · Grande (15 cm)', 14990)]
NOMBRES = ['Valentina Rojas', 'Matías González', 'Catalina Muñoz', 'Benjamín Soto', 'Antonia Díaz',
           'Vicente Pérez', 'Fernanda Silva', 'Joaquín Castro', 'Isidora Torres', 'Tomás Herrera']
# Estado según la antigüedad: los pedidos viejos ya se entregaron
FLUJO = ['pendiente', 'confirmado', 'en_produccion', 'enviado', 'entregado']


def crear(cantidad=80):
    rng = random.Random(2026)
    estados = {e.nombre_estado: e for e in EstadoPedido.query.all()}
    ahora = utc_now()
    for _ in range(cantidad):
        # Más pedidos en los meses recientes, para que se vea una tendencia
        dias = int(rng.triangular(0, 182, 0))
        fecha = ahora - timedelta(days=dias, hours=rng.randint(0, 12))
        avance = 4 if dias > 14 else min(4, dias // 3)
        nombre_estado = 'cancelado' if rng.random() < 0.06 else FLUJO[avance]

        detalles, personalizados = [], []
        for producto in rng.sample(PRODUCTOS, k=rng.choice([1, 1, 2, 3])):
            if rng.random() < 0.6 or not detalles:
                pid, nombre, categoria, precio, _ = producto
                cantidad_item = rng.choice([1, 1, 1, 2, 3])
                detalles.append(DetallePedido(id_producto=pid, nombre_producto=nombre, categoria=categoria,
                                              cantidad=cantidad_item, precio_unitario=precio,
                                              subtotal=precio * cantidad_item))
        if rng.random() < 0.3:
            detalle, precio = rng.choice(DISENOS)
            personalizados.append(DetallePersonalizado(
                codigo_solicitud=f'{rng.getrandbits(128):032x}', nombre=f'{CATEGORIA_DISENO}: Regalo',
                detalle=detalle, cantidad=1, precio_unitario=precio, subtotal=precio))

        historial = [HistorialEstado(estado=e, fecha=fecha + timedelta(days=i))
                     for i, e in enumerate(FLUJO[:avance + 1])]
        if nombre_estado == 'cancelado':
            historial = [HistorialEstado(estado='pendiente', fecha=fecha), HistorialEstado(estado='cancelado', fecha=fecha)]
        db.session.add(Pedido(
            fecha_pedido=fecha, estado=estados[nombre_estado], nombre_cliente=rng.choice(NOMBRES),
            telefono_cliente=f'+56 9 {rng.randint(1000, 9999)} {rng.randint(1000, 9999)}',
            metodo_entrega=rng.choice(['blue', 'metro']), detalle_entrega={}, observacion=MARCA,
            total=sum(d.subtotal for d in detalles + personalizados),
            detalles=detalles, personalizados=personalizados, historial=historial,
        ))
    db.session.commit()
    print(f'Listo: se crearon {cantidad} pedidos de ejemplo. Recarga el dashboard.')


def borrar():
    pedidos = Pedido.query.filter_by(observacion=MARCA).all()
    for pedido in pedidos:
        db.session.delete(pedido)
    db.session.commit()
    print(f'Listo: se eliminaron {len(pedidos)} pedidos de ejemplo.')


if __name__ == '__main__':
    with app.app_context():
        borrar() if '--borrar' in sys.argv else crear()
