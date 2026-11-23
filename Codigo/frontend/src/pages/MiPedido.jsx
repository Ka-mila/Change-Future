import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PedidoDetalle from '../components/PedidoDetalle.jsx';
import PagoTransferencia from '../components/PagoTransferencia.jsx';
import { api } from '../services/api.js';
import { formatPrice } from '../services/format.js';
import { mensajeWhatsApp } from '../services/pedidos.js';
import { usePedido } from '../services/usePedido.js';

const WHATSAPP_NUMBER = '56956912535';

// HU05.2 y HU05.3: detalle y estado de un pedido del cliente. También es la confirmación de compra (HU04.5).
export default function MiPedido() {
    const { id } = useParams();
    const { state } = useLocation();
    const { pedido, error, actualizado, actualizarPedido } = usePedido(id);
    const [estados, setEstados] = useState({});

    useEffect(() => {
        api.estadosPedido()
            .then((lista) => setEstados(Object.fromEntries(lista.map((e) => [e.id, e.descripcion]))))
            .catch(() => {});
    }, [id]);

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">MIS PEDIDOS</div>
                <div className="section-heading">
                    <h1>Pedido <span className="lime">N° {id}</span></h1>
                    <Link className="text-link" to="/mis-pedidos">← Todos mis pedidos</Link>
                </div>

                {(state?.recienRegistrado || state?.recienConfirmado) && pedido && (
                    <section className="confirmacion-compra" role="status">
                        <div className="empty-icon">✓</div>
                        <div>
                            <h2>¡Tu pedido quedó registrado!</h2>
                            <p>
                                Pedido N° {pedido.id} por {formatPrice(pedido.total)}. Revisa los datos de transferencia y adjunta
                                tu comprobante abajo. El pago será confirmado cuando el equipo lo verifique.
                            </p>
                        </div>
                    </section>
                )}

                {pedido && <div className="cf-order-tools"><div><span className="cf-live-dot" aria-hidden="true" /><span>Se actualiza automáticamente cada 18 segundos{actualizado ? ` · Última revisión ${actualizado.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}` : ''}.</span></div>
                    <a className="btn secondary small" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensajeWhatsApp(pedido))}`}>Coordinar por WhatsApp ↗</a></div>}

                {error && <p className="notice error" role="alert">{pedido ? `No pudimos actualizar por ahora. Conservamos la última información: ${error}` : error}</p>}
                {!pedido && !error && <p className="muted">Cargando…</p>}
                {pedido && <PedidoDetalle pedido={pedido} descripcionEstado={estados[pedido.estado]} contenidoPrincipal={<PagoTransferencia key={pedido.id} pedido={pedido} onActualizado={actualizarPedido} />} />}
            </div>
        </main>
    );
}
