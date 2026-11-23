"""Configura el correo local sin mostrar ni enviar la clave al chat."""
from pathlib import Path
import getpass
import json
import re
import shutil
from datetime import datetime

CORREO = 'changefuture.store@gmail.com'


def leer_env(ruta):
    valores = {}
    if not ruta.is_file():
        return valores
    for linea in ruta.read_text(encoding='utf-8-sig').splitlines():
        linea = linea.strip()
        if not linea or linea.startswith('#') or '=' not in linea:
            continue
        nombre, valor = linea.split('=', 1)
        nombre, valor = nombre.strip(), valor.strip()
        if len(valor) >= 2 and valor[0] == valor[-1] and valor[0] in ('"', "'"):
            valor = valor[1:-1]
        valores[nombre] = valor
    return valores


def configurar(base, archivos_anteriores=None, pedir_clave=None):
    base = Path(base).resolve()
    destino = base / '.env'
    if archivos_anteriores is None:
        archivos_anteriores = [
            destino,
            base / 'backend' / 'servicio-usuarios' / '.env',
            base / 'backend' / 'servicio-personalizacion' / '.env',
            Path.home() / 'OneDrive' / 'Documentos' / 'GitHub'
            / 'Change-Future' / 'Codigo' / 'backend'
            / 'servicio-personalizacion' / '.env',
        ]
    clave = ''
    for ruta in archivos_anteriores:
        datos = leer_env(Path(ruta))
        usuario = datos.get('SMTP_USER', CORREO).strip().lower()
        candidata = (datos.get('SMTP_PASSWORD') or datos.get('SMTP_APP_PASSWORD') or '').replace(' ', '')
        if usuario == CORREO and re.fullmatch(r'[A-Za-z0-9]{16}', candidata):
            clave = candidata
            print('Se encontro una configuracion local anterior del correo.')
            break
    if not clave:
        preguntar = pedir_clave or getpass.getpass
        for _ in range(3):
            clave = preguntar('Clave de aplicacion de Google (16 caracteres, no se muestra): ').replace(' ', '').strip()
            if re.fullmatch(r'[A-Za-z0-9]{16}', clave):
                break
            print('Debe ser la clave de aplicacion de 16 caracteres, no tu contrasena habitual.')
        else:
            raise ValueError('No se guardaron cambios: la clave no tiene el formato esperado.')

    plantilla = base / '.env.example'
    texto = destino.read_text(encoding='utf-8-sig') if destino.exists() else (
        plantilla.read_text(encoding='utf-8-sig') if plantilla.exists() else ''
    )
    cambios = {
        'SMTP_HOST': 'smtp.gmail.com',
        'SMTP_PORT': '587',
        'SMTP_USER': CORREO,
        'SMTP_PASSWORD': clave,
        'CF_ADMIN_EMAIL': CORREO,
        'FRONTEND_URL': leer_env(destino).get('FRONTEND_URL') or 'http://localhost:5173',
    }
    lineas, pendientes = [], set(cambios)
    for linea in texto.splitlines():
        nombre = linea.split('=', 1)[0].strip() if '=' in linea and not linea.lstrip().startswith('#') else ''
        if nombre in cambios:
            linea = nombre + '=' + json.dumps(cambios[nombre], ensure_ascii=False)
            pendientes.discard(nombre)
        lineas.append(linea)
    for nombre in cambios:
        if nombre in pendientes:
            lineas.append(nombre + '=' + json.dumps(cambios[nombre], ensure_ascii=False))
    if destino.exists():
        respaldo = base / '.respaldo-local'
        respaldo.mkdir(exist_ok=True)
        shutil.copy2(destino, respaldo / ('.env-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f')))
    temporal = base / '.env.nuevo'
    temporal.write_text('\n'.join(lineas).rstrip() + '\n', encoding='utf-8')
    temporal.replace(destino)
    print('Configuracion guardada en .env. La clave no se muestra.')
    print('Reinicia iniciar.bat para cargarla. El envio real se comprobara con un pedido de prueba.')
    return destino


if __name__ == '__main__':
    try:
        configurar(Path(__file__).parent)
    except (KeyboardInterrupt, EOFError):
        print('\nConfiguracion cancelada.')
    except (OSError, ValueError) as error:
        print('No se pudo completar la configuracion:', error)
