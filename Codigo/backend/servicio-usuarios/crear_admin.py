"""Convierte una cuenta existente en administrador.

Uso (desde la carpeta servicio-usuarios):  python crear_admin.py tucorreo@ejemplo.cl
Primero crea la cuenta normalmente en la página. Después vuelve a iniciar sesión.
"""
import sys

from app import app
from models import Rol, Usuario, db

if len(sys.argv) != 2:
    sys.exit('Uso: python crear_admin.py tucorreo@ejemplo.cl')

correo = sys.argv[1].strip().lower()
with app.app_context():
    usuario = Usuario.query.filter_by(correo=correo).first()
    if not usuario:
        sys.exit(f'No existe una cuenta con el correo {correo}. Créala primero en la página.')
    usuario.rol = Rol.query.filter_by(nombre_rol='administrador').first()
    db.session.commit()
    print(f'Listo: {usuario.nombre} ({correo}) ahora es administrador.')
    print('Cierra sesión y vuelve a ingresar para ver el panel de administración.')
