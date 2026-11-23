"""Validaciones de datos de usuario (las mismas reglas se aplican en el frontend)."""
import re

CORREO_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$')
TELEFONO_RE = re.compile(r'^\+?[\d\s]{8,15}$')


def normalizar_rut(rut):
    """Devuelve el RUT como '12345678-5', o None si no es válido."""
    limpio = re.sub(r'[.\-\s]', '', rut or '').upper()
    if not re.fullmatch(r'\d{7,8}[\dK]', limpio):
        return None

    cuerpo, dv = limpio[:-1], limpio[-1]
    suma, factor = 0, 2
    for digito in reversed(cuerpo):
        suma += int(digito) * factor
        factor = 2 if factor == 7 else factor + 1
    resto = 11 - suma % 11
    esperado = {11: '0', 10: 'K'}.get(resto, str(resto))

    return f'{cuerpo}-{dv}' if dv == esperado else None


def correo_valido(correo):
    return bool(CORREO_RE.match(correo or ''))


def error_contrasena(contrasena):
    """Devuelve el motivo por el que la contraseña no sirve, o None si es válida."""
    if len(contrasena or '') < 8:
        return 'La contraseña debe tener al menos 8 caracteres'
    if not re.search(r'[A-Za-z]', contrasena) or not re.search(r'\d', contrasena):
        return 'La contraseña debe tener al menos una letra y un número'
    return None


def validar_datos_personales(data, campos):
    """Valida nombre, apellido y teléfono. Devuelve un diccionario {campo: error}."""
    errores = {}
    for campo, etiqueta in (('nombre', 'El nombre'), ('apellido', 'El apellido')):
        if campo not in campos:
            continue
        valor = (data.get(campo) or '').strip()
        if not valor:
            errores[campo] = f'{etiqueta} es obligatorio'
        elif len(valor) > 80:
            errores[campo] = f'{etiqueta} no puede superar 80 caracteres'

    telefono = (data.get('telefono') or '').strip()
    if 'telefono' in campos and telefono and not TELEFONO_RE.match(telefono):
        errores['telefono'] = 'El teléfono no tiene un formato válido (ej: +56 9 1234 5678)'
    return errores
