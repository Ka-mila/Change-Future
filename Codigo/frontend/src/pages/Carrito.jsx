import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';
import { formatPrice } from '../services/format.js';

const WHATSAPP_NUMBER = '56956912535';

function buildWhatsAppMessage(pedido) {
    const entrega = pedido.detalle_entrega;
    const deliveryDetails = pedido.metodo_entrega === 'blue'
        ? [
            '🚚 Despacho: Blue Express',
            `Comuna: ${entrega.comuna}`,
            `Dirección: ${entrega.direccion}`,
            entrega.referencia ? `Referencia: ${entrega.referencia}` : null,
            'Costo del envío: pendiente de cotización'
        ].filter(Boolean)
        : [
            `🚇 Entrega en Metro: ${entrega.estacion}`,
            `Horario preferido: ${entrega.horario || 'A coordinar'}`
        ];

    return [
        `🟢 CHANGE FUTURE | PEDIDO N° ${pedido.id}`,
        '',
        `Cliente: ${pedido.cliente}`,
        `Teléfono: ${pedido.telefono}`,
        '',
        'PRODUCTOS',
        ...pedido.items.map((item) => `• ${item.nombre} x ${item.cantidad}: ${formatPrice(item.subtotal)}`),
        '',
        `Subtotal productos: ${formatPrice(pedido.total)}`,
        '',
        'ENTREGA',
        ...deliveryDetails,
        '',
        'Total final: pendiente de confirmar por WhatsApp'
    ].join('\n');
}

export default function Carrito() {
    const { items, subtotal, setQuantity, removeItem, clear } = useCart();
    const { user } = useAuth();
    const [metodo, setMetodo] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    async function sendOrder(event) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        setSending(true);
        setError('');

        // Se abre antes del await para que el navegador no bloquee la ventana emergente.
        const whatsappWindow = window.open('', '_blank');
        try {
            const pedido = await api.crearPedido({
                nombre_cliente: data.customerName,
                telefono_cliente: data.customerPhone,
                metodo_entrega: metodo,
                detalle_entrega: metodo === 'blue'
                    ? { comuna: data.commune, direccion: data.address, referencia: data.reference }
                    : { estacion: data.metroStation, horario: data.meetingTime },
                items: items.map((item) => ({ id_producto: item.id, cantidad: item.cantidad }))
            });
            const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(pedido))}`;
            if (whatsappWindow) whatsappWindow.location.href = url;
            else window.location.href = url;
            clear();
        } catch (e) {
            whatsappWindow?.close();
            setError(e.message);
        } finally {
            setSending(false);
        }
    }

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">TU PEDIDO</div>
                <div className="section-heading">
                    <h1>Tu <span className="lime">carrito</span></h1>
                    <Link className="text-link" to="/catalogo">← Seguir viendo productos</Link>
                </div>

                {items.length === 0 ? (
                    <section className="empty-state cart-list">
                        <div className="empty-icon">🛒</div>
                        <h2>Tu carrito está vacío</h2>
                        <p>Cuando encuentres algo que te guste, agrégalo aquí.</p>
                        <Link className="btn" to="/catalogo">Explorar catálogo&nbsp; →</Link>
                    </section>
                ) : (
                    <div className="cart-layout">
                        <section className="cart-list">
                            <h2 className="summary-title">Productos seleccionados</h2>
                            {items.map((item) => (
                                <article className="cart-row" key={item.id}>
                                    <Link className="cart-thumb" to={`/producto/${item.id}`}>
                                        <img src={item.imagen} alt={`Vista previa: ${item.nombre}`} />
                                    </Link>
                                    <div className="cart-name">
                                        {item.nombre}
                                        <small>{item.categoria}</small>
                                        <small>{formatPrice(item.precio)} por unidad</small>
                                    </div>
                                    <div className="quantity-control">
                                        <button type="button" aria-label="Disminuir" onClick={() => setQuantity(item.id, item.cantidad - 1)}>−</button>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.cantidad}
                                            aria-label={`Cantidad de ${item.nombre}`}
                                            onChange={(e) => setQuantity(item.id, e.target.value)}
                                        />
                                        <button type="button" aria-label="Aumentar" onClick={() => setQuantity(item.id, item.cantidad + 1)}>＋</button>
                                    </div>
                                    <div className="cart-line-total">{formatPrice(item.precio * item.cantidad)}</div>
                                    <button className="remove-button" type="button" aria-label={`Eliminar ${item.nombre}`} onClick={() => removeItem(item.id)}>×</button>
                                </article>
                            ))}
                        </section>

                        <aside className="cart-summary">
                            <h2 className="summary-title">Resumen del pedido</h2>
                            <div className="summary-row"><span>Subtotal productos</span><b>{formatPrice(subtotal)}</b></div>
                            <div className="summary-row"><span>Envío</span><b>A coordinar</b></div>
                            <div className="summary-row total"><span>Total productos</span><b>{formatPrice(subtotal)}</b></div>
                            <p className="summary-note">
                                El envío se coordina según la comuna de destino. El pedido queda registrado y lo confirmamos por WhatsApp.
                            </p>

                            <form className="order-form" onSubmit={sendOrder}>
                                <label className="form-label" htmlFor="order-customer-name">Tu nombre</label>
                                <input className="field" id="order-customer-name" name="customerName" defaultValue={user?.nombre || ''} placeholder="Nombre completo" required />

                                <label className="form-label" htmlFor="order-customer-phone">Tu teléfono</label>
                                <input className="field" id="order-customer-phone" name="customerPhone" type="tel" defaultValue={user?.telefono || ''} placeholder="+56 9 1234 5678" autoComplete="tel" required />

                                <label className="form-label" htmlFor="order-delivery-method">¿Cómo quieres recibirlo?</label>
                                <select className="field" id="order-delivery-method" value={metodo} onChange={(e) => setMetodo(e.target.value)} required>
                                    <option value="">Elige una opción</option>
                                    <option value="blue">Despacho Blue Express</option>
                                    <option value="metro">Entrega en Metro</option>
                                </select>

                                {metodo === 'blue' && (
                                    <div>
                                        <label className="form-label" htmlFor="order-commune">Comuna</label>
                                        <input className="field" id="order-commune" name="commune" placeholder="Tu comuna" required />
                                        <label className="form-label" htmlFor="order-address">Dirección</label>
                                        <input className="field" id="order-address" name="address" placeholder="Calle y número" required />
                                        <label className="form-label" htmlFor="order-reference">Referencia (opcional)</label>
                                        <input className="field" id="order-reference" name="reference" placeholder="Casa, departamento u otra referencia" />
                                    </div>
                                )}

                                {metodo === 'metro' && (
                                    <div>
                                        <label className="form-label" htmlFor="order-metro-station">Estación</label>
                                        <select className="field" id="order-metro-station" name="metroStation" required>
                                            <option value="">Elige una estación</option>
                                            <option value="Rojas Magallanes">Rojas Magallanes</option>
                                            <option value="Bellavista de La Florida">Bellavista de La Florida</option>
                                        </select>
                                        <label className="form-label" htmlFor="order-meeting-time">Horario que prefieres</label>
                                        <input className="field" id="order-meeting-time" name="meetingTime" placeholder="Ej.: sábado por la tarde" />
                                    </div>
                                )}

                                {error && <p className="notice">{error}</p>}
                                <button className="btn" type="submit" disabled={sending}>
                                    {sending ? 'Enviando…' : <>Enviar pedido por WhatsApp&nbsp; →</>}
                                </button>
                            </form>
                            <Link className="btn" to="/catalogo">Seguir comprando&nbsp; →</Link>
                        </aside>
                    </div>
                )}
            </div>
        </main>
    );
}
