"""Datos iniciales: los mismos productos del prototipo HTML."""
from models import Categoria, Producto, db

PLACEHOLDER = '/assets/images/product-placeholder.svg'

PRODUCTOS = [
    ('Figura personalizada', 'Figuras 3D', 12990, 'Figura diseñada mediante impresión 3D, ideal para decoración, regalos o proyectos personalizados.', 'Disponible', False),
    ('Decoración personalizada', 'Decoración', 8990, 'Diseños únicos para decorar tus espacios.', 'Disponible', False),
    ('Accesorio Gaming', 'Gaming', 6990, 'Accesorios impresos en 3D para tu setup.', 'Disponible', False),
    ('Accesorio para vehículo', 'Automotriz', 9990, 'Piezas y accesorios personalizados mediante impresión 3D.', 'A medida', False),
    ('Macetero geométrico', 'Maceteros', 7990, 'Maceteros con diseños modernos y diferentes tamaños.', 'Disponible', True),
    ('Llavero personalizado', 'Llaveros', 3990, 'Un llavero con tu nombre, iniciales o diseño favorito.', 'Personalizable', True),
    ('Soporte para celular', 'Soportes', 5990, 'Soporte compacto para mantener tu teléfono a la vista.', 'Disponible', True),
    ('Organizador de escritorio', 'Organizadores', 12990, 'Ordena lápices, herramientas y accesorios con estilo.', 'A medida', True),
]


def seed_catalogo():
    if Producto.query.first():
        return

    categorias = {}
    for nombre, categoria, precio, descripcion, personalizacion, destacado in PRODUCTOS:
        if categoria not in categorias:
            categorias[categoria] = Categoria(nombre=categoria)
            db.session.add(categorias[categoria])
        db.session.add(Producto(
            nombre=nombre,
            categoria=categorias[categoria],
            precio_base=precio,
            descripcion=descripcion,
            personalizacion=personalizacion,
            imagen_principal=PLACEHOLDER,
            stock=20,
            destacado=destacado,
        ))
    db.session.commit()
