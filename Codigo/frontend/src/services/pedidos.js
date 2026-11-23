// Textos y formatos compartidos por las páginas de pedidos (cliente y administrador).
import { formatPrice } from './format.js';

export const ESTADOS = {
    pendiente: { nombre: 'Pendiente', icono: '◷' },
    confirmado: { nombre: 'Confirmado', icono: '✓' },
    en_produccion: { nombre: 'En producción', icono: '⚙' },
    enviado: { nombre: 'Enviado', icono: '➜' },
    entregado: { nombre: 'Entregado', icono: '★' },
    cancelado: { nombre: 'Cancelado', icono: '✕' }
};

// Etapas en orden, para la barra de avance (cancelado queda aparte)
export const ETAPAS = ['pendiente', 'confirmado', 'en_produccion', 'enviado', 'entregado'];

export const PAGOS = {
    pendiente: { nombre: 'Pendiente de transferencia', clase: 'pendiente' },
    en_revision: { nombre: 'Comprobante en revisión', clase: 'revision' },
    aprobado: { nombre: 'Pago verificado', clase: 'aprobado' },
    rechazado: { nombre: 'Comprobante observado', clase: 'rechazado' }
};

export function nombrePago(estado) {
    return PAGOS[estado]?.nombre || 'Pago a coordinar';
}

export function nombrePagoPedido(pedido) {
    return (pedido.pago?.metodo || pedido.metodo_pago) === 'transferencia'
        ? nombrePago(pedido.pago?.estado || pedido.estado_pago) : 'Pago a coordinar';
}

export function subtotalPedido(pedido) {
    return pedido.subtotal ?? (pedido.items || []).reduce((suma, item) => suma + Number(item.subtotal || 0), 0);
}

export function nombreEstado(estado) {
    return ESTADOS[estado]?.nombre || estado;
}

export function formatearFecha(iso, conHora = false) {
    if (!iso) return '—';
    return new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).toLocaleString('es-CL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {})
    });
}

export function describirEntrega(pedido) {
    const entrega = pedido.detalle_entrega || {};
    if (pedido.metodo_entrega === 'blue') {
        return ['Despacho a domicilio · Blue Express', [entrega.direccion, entrega.comuna].filter(Boolean).join(', '),
            pedido.envio?.region_nombre || entrega.region_nombre, entrega.referencia,
            pedido.envio?.talla && `Talla estimada: ${pedido.envio.talla}`,
            pedido.envio?.simulado && 'Costo de despacho simulado; pendiente de validación con Blue Express.',
            pedido.codigo_seguimiento && `Código de seguimiento: ${pedido.codigo_seguimiento}`]
            .filter(Boolean);
    }
    return ['Entrega en Metro', entrega.estacion, entrega.horario && `Horario preferido: ${entrega.horario}`].filter(Boolean);
}

export function mensajeWhatsApp(pedido) {
    const envio = pedido.costo_envio;
    return [
        `🟢 CHANGE FUTURE | PEDIDO N° ${pedido.id}`,
        '', 'CONTACTO', `Cliente: ${pedido.cliente}`, `Teléfono: ${pedido.telefono}`,
        pedido.correo && `Correo: ${pedido.correo}`,
        '', 'PRODUCTOS',
        ...(pedido.items || []).map((item) => [
            `• ${item.nombre} × ${item.cantidad}: ${formatPrice(item.subtotal)}`,
            item.detalle && `  ${item.detalle}`,
            item.codigo_solicitud && `  Diseño: ${item.codigo_solicitud.slice(0, 8)}`
        ].filter(Boolean).join('\n')),
        '', 'RESUMEN',
        `Productos: ${formatPrice(subtotalPedido(pedido))}`,
        `Despacho: ${envio == null ? 'A coordinar' : formatPrice(envio)}${pedido.envio?.simulado ? ' (simulado)' : ''}`,
        `Total del pedido: ${formatPrice(pedido.total)}`,
        `Pago: ${nombrePagoPedido(pedido)}`,
        '', 'ENTREGA', ...describirEntrega(pedido),
        pedido.observacion && `Comentarios: ${pedido.observacion}`,
        '', 'Quiero coordinar mi pedido con Change Future.'
    ].filter((linea) => linea !== false && linea !== null && linea !== undefined).join('\n');
}
