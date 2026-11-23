"""Correo de recuperación. Sin SMTP, no imprime ni devuelve el enlace privado."""
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from html import escape


logger = logging.getLogger(__name__)
SMTP_TIMEOUT = 8


def _clave_smtp():
    # Google muestra las claves de aplicación separadas en grupos por espacios.
    return (os.getenv('SMTP_PASSWORD') or os.getenv('SMTP_APP_PASSWORD') or '').replace(' ', '')


def correo_configurado():
    """Solo informa sobre configuración global; no revela si existe una cuenta."""
    return bool((os.getenv('SMTP_HOST') or '').strip()
                and (os.getenv('SMTP_USER') or '').strip() and _clave_smtp())


def crear_mensaje_recuperacion(destinatario, nombre, enlace):
    mensaje = EmailMessage()
    mensaje['Subject'] = 'Change Future: recupera tu contraseña'
    mensaje['From'] = os.getenv('SMTP_FROM') or formataddr(('Change Future', os.getenv('SMTP_USER', '')))
    mensaje['To'] = destinatario
    mensaje.set_content(
        f'Hola, {nombre}:\n\n'
        'Recibimos una solicitud para restablecer la contraseña de tu cuenta Change Future.\n'
        f'Abre este enlace para crear una nueva (vence en 30 minutos y es de un solo uso):\n\n{enlace}\n\n'
        'Si no fuiste tú, ignora este mensaje. Tu contraseña seguirá igual.\n'
        'Nunca te pediremos tu contraseña por correo ni por WhatsApp.\n\n'
        'Change Future · Ideas que cobran forma\n'
    )
    nombre_html = escape(str(nombre))
    enlace_html = escape(str(enlace), quote=True)
    mensaje.add_alternative(f'''<!doctype html>
<html lang="es"><body style="margin:0;padding:24px 12px;background:#090b1b;color:#f8f7ff;font-family:Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#171a31;border:1px solid #454a64;border-radius:18px;overflow:hidden;">
<tr><td style="padding:28px 30px;border-bottom:3px solid #a8ff27;">
<p style="margin:0;color:#f8f7ff;font-size:22px;font-weight:bold;">Change <span style="color:#a8ff27;">Future</span></p>
<p style="margin:8px 0 0;color:#c6c5d9;font-size:12px;letter-spacing:2px;">TU ESPACIO CREATIVO</p>
</td></tr><tr><td style="padding:30px;">
<p style="margin:0 0 16px;color:#c6c5d9;">Hola, {nombre_html}:</p>
<h1 style="margin:0 0 18px;font-size:27px;line-height:1.25;color:#f8f7ff;">Recupera el acceso<br>a tu <span style="color:#a8ff27;">cuenta.</span></h1>
<p style="margin:0 0 24px;line-height:1.6;color:#c6c5d9;">Recibimos una solicitud para cambiar tu contraseña. El siguiente enlace es de un solo uso y vence en <strong style="color:#f8f7ff;">30 minutos</strong>.</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:24px;background:#a8ff27;">
<a href="{enlace_html}" style="display:inline-block;padding:14px 23px;color:#090b1b;text-decoration:none;font-size:14px;font-weight:bold;">Crear nueva contraseña →</a>
</td></tr></table>
<p style="margin:24px 0 10px;line-height:1.5;color:#c6c5d9;font-size:12px;">Si el botón no funciona, copia y pega esta dirección en tu navegador:</p>
<p style="margin:0;word-break:break-all;font-size:12px;line-height:1.5;"><a href="{enlace_html}" style="color:#bca0f5;">{enlace_html}</a></p>
<p style="margin:26px 0 0;padding:16px;border-left:3px solid #a347db;background:#111426;color:#c6c5d9;line-height:1.6;font-size:12px;">Si no hiciste esta solicitud, puedes ignorar el mensaje. Tu contraseña seguirá igual. Nunca te pediremos tu contraseña por correo ni por WhatsApp.</p>
</td></tr><tr><td style="padding:18px 30px;border-top:1px solid #454a64;color:#c6c5d9;font-size:11px;">Change Future · Ideas que cobran forma</td></tr>
</table></td></tr></table></body></html>''', subtype='html')
    return mensaje


def enviar_enlace_recuperacion(destinatario, nombre, enlace):
    """Devuelve enviado/no_configurado/error; una falla de correo no rompe la API."""
    if not correo_configurado():
        return 'no_configurado'

    try:
        host = os.environ['SMTP_HOST'].strip()
        puerto = int(os.getenv('SMTP_PORT') or '587')
        usuario = os.environ['SMTP_USER'].strip()
        mensaje = crear_mensaje_recuperacion(destinatario, nombre, enlace)
        contexto = ssl.create_default_context()
        if puerto == 465:
            conexion = smtplib.SMTP_SSL(host, puerto, timeout=SMTP_TIMEOUT, context=contexto)
        else:
            conexion = smtplib.SMTP(host, puerto, timeout=SMTP_TIMEOUT)
        with conexion as servidor:
            if puerto != 465:
                servidor.ehlo()
                servidor.starttls(context=contexto)
                servidor.ehlo()
            servidor.login(usuario, _clave_smtp())
            servidor.send_message(mensaje)
        return 'enviado'
    except Exception as exc:
        # No imprimir str(exc), trazas, destinatarios, enlaces ni credenciales.
        logger.warning('No se pudo enviar el correo de recuperación (%s).', type(exc).__name__)
        return 'error'
