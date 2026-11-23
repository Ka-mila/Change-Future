"""Colores y tamaños disponibles para "Crea desde cero"."""
from models import Color, Tamano, db

COLORES = [
    ('Negro', '#1d1d24'),
    ('Blanco', '#f2f2ef'),
    ('Gris', '#8a8d93'),
    ('Morado', '#a347db'),
    ('Verde lima', '#a8ff27'),
    ('Azul', '#2f6fde'),
    ('Rojo', '#d93a3a'),
    ('Amarillo', '#f2c230'),
]

TAMANOS = [
    ('Pequeño', 'Ideal para llaveros e imanes', 50, 5990),
    ('Mediano', 'Para adornos y placas', 100, 9990),
    ('Grande', 'Cuadros y piezas destacadas', 150, 14990),
]


def seed_opciones():
    if not Color.query.first():
        db.session.add_all(Color(nombre=nombre, codigo_hex=hex_) for nombre, hex_ in COLORES)
    if not Tamano.query.first():
        db.session.add_all(
            Tamano(nombre=nombre, descripcion=descripcion, medida_mm=medida, precio_referencial=precio)
            for nombre, descripcion, medida, precio in TAMANOS
        )
    db.session.commit()
