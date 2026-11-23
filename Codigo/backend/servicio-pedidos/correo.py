"""Notificaciones separadas a negocio y cliente; nunca adjunta comprobantes privados."""
from email.message import EmailMessage
from html import escape
import logging
import os
import smtplib
import ssl

LOG = logging.getLogger(__name__)
EVENTOS = {
    'pedido_registrado': ('Pedido recibido', 'Guardamos tu pedido. Revisa los datos de transferencia y adjunta tu comprobante en la página.'),
    'comprobante_recibido': ('Comprobante recibido', 'El comprobante está en revisión. Adjuntarlo no confirma el pago; el negocio lo verificará.'),
    'pago_aprobado': ('Pago verificado', 'El negocio verificó la transferencia y confirmó tu pedido.'),
    'pago_rechazado': ('Necesitamos revisar tu transferencia', 'Revisa la observación del negocio. Puedes adjuntar un nuevo comprobante en tu pedido.'),
    'estado_actualizado': ('Tu pedido avanzó', 'Actualizamos el estado de tu pedido. Puedes revisar el detalle y el historial en tu cuenta.'),
}
NOMBRES = {'pendiente': 'Pendiente de pago', 'confirmado': 'Confirmado', 'en_produccion': 'En producción',
           'enviado': 'Enviado / listo para entregar', 'entregado': 'Entregado', 'cancelado': 'Cancelado'}


def dinero(valor):
    return '$' + f'{int(valor):,}'.replace(',', '.')


def construir_mensaje(pedido, evento, destinatario, negocio=False):
    titulo, texto = EVENTOS[evento]
    base = os.getenv('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    ruta = f'/admin/pedidos/{pedido.id_pedido}' if negocio else f'/mis-pedidos/{pedido.id_pedido}'
    enlace = base + ruta
    filas = [(item['nombre'] + (' · ' + item['detalle'] if item.get('detalle') else ''),
              f"{item['cantidad']} × {dinero(item['precio_unitario'])}", dinero(item['subtotal']))
             for item in pedido.items]
    entrega = pedido.detalle_entrega or {}
    direccion = (', '.join(str(entrega.get(k) or '') for k in ('direccion', 'comuna', 'region') if entrega.get(k))
                 if pedido.metodo_entrega == 'blue' else 'Metro · ' + str(entrega.get('estacion') or 'Por coordinar'))
    resumen = [f'Cliente: {pedido.nombre_cliente}', f'Estado: {NOMBRES.get(pedido.estado.nombre_estado, pedido.estado.nombre_estado)}',
               f'Teléfono: {pedido.telefono_cliente}', f'Entrega: {direccion}']
    extras_entrega = [str(entrega[campo]) for campo in ('referencia', 'horario') if entrega.get(campo)]
    if extras_entrega:
        resumen.append('Detalle de entrega: ' + ' · '.join(extras_entrega))
    if pedido.observacion:
        resumen.append('Comentarios del pedido: ' + pedido.observacion)
    resumen += [f'{nombre}: {detalle} = {total}' for nombre, detalle, total in filas]
    resumen += [f'Productos: {dinero(pedido.subtotal_productos if pedido.subtotal_productos is not None else pedido.total)}',
                f'Despacho: {dinero(pedido.costo_envio or 0)}', f'Total: {dinero(pedido.total)}']
    if (pedido.envio or {}).get('simulado'):
        resumen.append('Despacho SIMULADO para presentación. No es una tarifa oficial de Blue Express.')
    if pedido.observacion_pago:
        resumen.append('Observación del pago: ' + pedido.observacion_pago)
    if pedido.codigo_seguimiento:
        resumen.append('Seguimiento: ' + pedido.codigo_seguimiento)
    resumen.append(enlace)
    mensaje = EmailMessage()
    mensaje['Subject'] = f'{titulo} · Pedido #{pedido.id_pedido} · Change Future'
    mensaje['From'] = f"Change Future <{os.getenv('SMTP_USER', '')}>"
    mensaje['To'] = destinatario
    mensaje['Reply-To'] = os.getenv('CF_ADMIN_EMAIL', 'changefuture.store@gmail.com')
    mensaje.set_content(f'{titulo}\n\nHola {pedido.nombre_cliente},\n\n{texto}\n\n' + '\n'.join(resumen))
    lineas = ''.join('<tr><td style="padding:12px;border-bottom:1px solid #eee">' + escape(nombre) +
                     '</td><td style="padding:12px;border-bottom:1px solid #eee">' + escape(detalle) +
                     '</td><td style="padding:12px;border-bottom:1px solid #eee;text-align:right">' + escape(total) + '</td></tr>'
                     for nombre, detalle, total in filas)
    aviso = ('<p style="background:#f3eefc;padding:12px;border-radius:10px">Despacho <b>SIMULADO</b> para presentación; '
             'no es una tarifa oficial de Blue Express.</p>' if (pedido.envio or {}).get('simulado') else '')
    observacion = ('<p><b>Observación del pago:</b> ' + escape(pedido.observacion_pago) + '</p>' if pedido.observacion_pago else '')
    seguimiento = ('<p><b>Seguimiento:</b> ' + escape(pedido.codigo_seguimiento) + '</p>' if pedido.codigo_seguimiento else '')
    detalles_entrega = ('<p><b>Detalle de entrega:</b> ' + escape(' · '.join(extras_entrega)) + '</p>' if extras_entrega else '')
    comentarios = ('<p><b>Comentarios del pedido:</b> ' + escape(pedido.observacion) + '</p>' if pedido.observacion else '')
    mensaje.add_alternative(f'''<!doctype html><html lang="es"><body style="margin:0;background:#f1f2f7;font-family:Arial,sans-serif;color:#19172a">
      <div style="max-width:640px;margin:24px auto;background:white;border-radius:18px;overflow:hidden">
        <div style="background:#131124;padding:26px;color:white"><b style="font-size:24px">Change <span style="color:#a8ff27">Future</span></b>
          <p style="margin-bottom:0;color:#d1c9e8">Ideas que cobran forma</p></div>
        <div style="padding:28px"><p style="color:#7450a0;font-weight:bold">PEDIDO #{pedido.id_pedido}</p>
          <h1 style="font-size:26px">{escape(titulo)}</h1><p>Hola {escape(pedido.nombre_cliente)},</p><p>{escape(texto)}</p>
          <p><b>Estado:</b> {escape(NOMBRES.get(pedido.estado.nombre_estado, pedido.estado.nombre_estado))}</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px">{lineas}</table>
          <p>Productos: {dinero(pedido.subtotal_productos if pedido.subtotal_productos is not None else pedido.total)}<br>
          Despacho: {dinero(pedido.costo_envio or 0)}</p><p style="font-size:22px"><b>Total: {dinero(pedido.total)}</b></p>
          <p><b>Entrega:</b> {escape(direccion)}</p>{detalles_entrega}{comentarios}{aviso}{observacion}{seguimiento}
          <p style="padding-top:12px"><a href="{escape(enlace, quote=True)}" style="display:inline-block;background:#a8ff27;color:#111;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">Ver pedido</a></p>
          <p style="font-size:12px;color:#676279">El comprobante se revisa dentro de la plataforma. Nunca compartimos tu captura en este correo.</p>
        </div></div></body></html>''', subtype='html')
    return mensaje


def enviar_notificaciones(pedido, evento):
    usuario = os.getenv('SMTP_USER', '').strip()
    clave = (os.getenv('SMTP_PASSWORD') or os.getenv('SMTP_APP_PASSWORD') or '').replace(' ', '')
    destinatarios = {'negocio': os.getenv('CF_ADMIN_EMAIL', 'changefuture.store@gmail.com').strip(),
                    'cliente': pedido.correo_cliente or ''}
    estados = {}
    for tipo, correo in destinatarios.items():
        if not usuario or not clave or not correo:
            estados[tipo] = 'no_configurado'
            continue
        try:
            mensaje = construir_mensaje(pedido, evento, correo, negocio=tipo == 'negocio')
            host, port = os.getenv('SMTP_HOST', 'smtp.gmail.com'), int(os.getenv('SMTP_PORT', '587'))
            if port == 465:
                transporte = smtplib.SMTP_SSL(host, port, timeout=5, context=ssl.create_default_context())
            else:
                transporte = smtplib.SMTP(host, port, timeout=5)
            with transporte as servidor:
                if port != 465:
                    servidor.starttls(context=ssl.create_default_context())
                servidor.login(usuario, clave)
                servidor.send_message(mensaje)
            estados[tipo] = 'enviado'
        except Exception as exc:
            # No registrar mensajes SMTP ni claves: algunos proveedores incluyen datos sensibles.
            LOG.warning('No se pudo enviar notificación %s al %s (%s).', evento, tipo, type(exc).__name__)
            estados[tipo] = 'error'
    return estados
