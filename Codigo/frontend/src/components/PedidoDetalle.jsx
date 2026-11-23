import EstadoBadge from './EstadoBadge.jsx';
import SeguimientoPedido from './SeguimientoPedido.jsx';
import { formatPrice } from '../services/format.js';
import { describirEntrega, formatearFecha, nombrePagoPedido, subtotalPedido } from '../services/pedidos.js';

export default function PedidoDetalle({ pedido, descripcionEstado, children, contenidoPrincipal }) {
    return (
        <div className="pedido-layout">
            <section className="cart-list">
                <SeguimientoPedido pedido={pedido} descripcionEstado={descripcionEstado} />
                {contenidoPrincipal}

                <h2 className="summary-title" style={{ marginTop: 26 }}>Productos</h2>
                {(pedido.items || []).map((item, index) => (
                    <div className="pedido-item" key={`${item.id_producto || item.codigo_solicitud}-${index}`}>
                        <div>
                            <b>{item.nombre}</b>
                            {item.detalle && <small className="pedido-personalizacion">Personalización: {item.detalle}</small>}
                            {!item.detalle && item.categoria && <small>{item.categoria}</small>}
                            <small>{item.cantidad} × {formatPrice(item.precio_unitario)}</small>
                        </div>
                        <b>{formatPrice(item.subtotal)}</b>
                    </div>
                ))}
                <div className="summary-row"><span>Subtotal de productos</span><b>{formatPrice(subtotalPedido(pedido))}</b></div>
                <div className="summary-row"><span>{pedido.envio?.simulado ? 'Despacho simulado' : 'Entrega'}</span><b>{pedido.costo_envio == null ? 'A coordinar' : formatPrice(pedido.costo_envio)}</b></div>
                <div className="summary-row total"><span>Total del pedido</span><b>{formatPrice(pedido.total)}</b></div>
                {pedido.envio?.simulado && <p className="cf-simulation-note">Este pedido incluye una simulación de despacho. Change Future debe validar el costo antes del envío; no es una cotización oficial de Blue Express.</p>}

                {pedido.historial?.length > 0 && (
                    <>
                        <h2 className="summary-title" style={{ marginTop: 26 }}>Historial</h2>
                        <ul className="historial-estados">
                            {[...pedido.historial].reverse().map((h, index) => (
                                <li key={index}>
                                    <EstadoBadge estado={h.estado} />
                                    <span className="muted">{formatearFecha(h.fecha, true)}</span>
                                    {h.comentario && <p>{h.comentario}</p>}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </section>

            <aside className="cart-summary">
                <h2 className="summary-title">Datos del pedido</h2>
                <div className="summary-row"><span>Número</span><b>N° {pedido.id}</b></div>
                <div className="summary-row"><span>Fecha</span><b>{formatearFecha(pedido.fecha, true)}</b></div>
                <div className="summary-row"><span>Cliente</span><b>{pedido.cliente}</b></div>
                <div className="summary-row"><span>Teléfono</span><b>{pedido.telefono}</b></div>
                {pedido.correo && <div className="summary-row"><span>Correo</span><b className="cf-break-word">{pedido.correo}</b></div>}
                <div className="summary-row"><span>Pago</span><b>{nombrePagoPedido(pedido)}</b></div>
                <h3 className="summary-subtitle">Entrega</h3>
                {describirEntrega(pedido).map((linea) => <p className="pedido-entrega" key={linea}>{linea}</p>)}
                {pedido.observacion && <><h3 className="summary-subtitle">Comentarios</h3><p className="pedido-entrega">{pedido.observacion}</p></>}
                {children}
            </aside>
        </div>
    );
}
