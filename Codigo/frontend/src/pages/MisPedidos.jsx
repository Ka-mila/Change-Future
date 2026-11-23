import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EstadoBadge from '../components/EstadoBadge.jsx';
import { api } from '../services/api.js';
import { formatPrice } from '../services/format.js';
import { formatearFecha, nombrePagoPedido } from '../services/pedidos.js';
import '../styles/checkout.css';

// HU05.1: historial de pedidos del cliente que inició sesión
export default function MisPedidos() {
    const [pedidos, setPedidos] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let activo = true;
        let ocupado = false;
        async function cargar() {
            if (ocupado || document.visibilityState === 'hidden') return;
            ocupado = true;
            try { const lista = await api.misPedidos(); if (activo) { setPedidos(lista); setError(''); } }
            catch (e) { if (activo) setError(e.message); }
            finally { ocupado = false; }
        }
        cargar();
        const reloj = window.setInterval(cargar, 18000);
        return () => { activo = false; window.clearInterval(reloj); };
    }, []);

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">MI CUENTA</div>
                <div className="section-heading">
                    <h1>Mis <span className="lime">pedidos</span></h1>
                    <Link className="text-link" to="/perfil">← Volver a mi perfil</Link>
                </div>
                {error && <p className="notice error">{error}</p>}
                {!pedidos && !error && <p className="muted">Cargando…</p>}
                {pedidos?.length === 0 && (
                    <section className="empty-state cart-list">
                        <div className="empty-icon">📦</div>
                        <h2>Todavía no tienes pedidos</h2>
                        <p>Cuando registres un pedido, lo verás aquí con el estado de su pago y entrega.</p>
                        <Link className="btn" to="/catalogo">Explorar catálogo&nbsp; →</Link>
                    </section>
                )}
                {pedidos?.length > 0 && (
                    <div className="tabla-contenedor cart-list">
                        <table className="tabla">
                            <thead>
                                <tr><th>N°</th><th>Fecha</th><th>Pedido</th><th>Pago</th><th>Productos</th><th className="num">Total</th><th><span className="sr-only">Acciones</span></th></tr>
                            </thead>
                            <tbody>
                                {pedidos.map((p) => (
                                    <tr key={p.id}>
                                        <td><b>{p.id}</b></td>
                                        <td>{formatearFecha(p.fecha)}</td>
                                        <td><EstadoBadge estado={p.estado} /></td>
                                        <td><span className={`cf-status-pill cf-payment-${p.metodo_pago === 'transferencia' ? p.estado_pago : 'coordinado'}`}>{nombrePagoPedido(p)}</span></td>
                                        <td>{p.cantidad_productos}</td>
                                        <td className="num">{formatPrice(p.total)}</td>
                                        <td className="num"><Link className="text-link" to={`/mis-pedidos/${p.id}`}>Ver detalle →</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
}
