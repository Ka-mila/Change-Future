from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Categoria(db.Model):
    __tablename__ = 'categoria'

    id_categoria = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(60), unique=True, nullable=False)
    descripcion = db.Column(db.String(200))
    estado = db.Column(db.String(20), default='activo')

    def to_dict(self):
        return {'id': self.id_categoria, 'nombre': self.nombre, 'descripcion': self.descripcion}


class Producto(db.Model):
    __tablename__ = 'producto'

    id_producto = db.Column(db.Integer, primary_key=True)
    id_categoria = db.Column(db.Integer, db.ForeignKey('categoria.id_categoria'), nullable=False)
    nombre = db.Column(db.String(120), nullable=False)
    descripcion = db.Column(db.Text)
    precio_base = db.Column(db.Integer, nullable=False)
    stock = db.Column(db.Integer, default=0)
    material = db.Column(db.String(40), default='PLA')
    personalizacion = db.Column(db.String(40), default='Disponible')
    imagen_principal = db.Column(db.String(255))
    modelo_3d = db.Column(db.String(255))
    destacado = db.Column(db.Boolean, default=False)
    estado = db.Column(db.String(20), default='activo')

    categoria = db.relationship('Categoria')

    def to_dict(self):
        return {
            'id': self.id_producto,
            'nombre': self.nombre,
            'categoria': self.categoria.nombre,
            'precio': self.precio_base,
            'descripcion': self.descripcion,
            'material': self.material,
            'personalizacion': self.personalizacion,
            'imagen': self.imagen_principal,
            'stock': self.stock,
            'destacado': self.destacado,
        }
