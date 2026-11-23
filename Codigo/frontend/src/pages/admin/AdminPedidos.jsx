import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminNav from '../../components/admin/AdminNav.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import { api } from '../../services/api.js';
import { formatPrice } from '../../services/format.js';
import { ETAPAS, formatearFecha, nombreEstado, nombrePagoPedido } from '../../services/pedidos.js';
import '../../styles/checkout.css';

// HU05.5: pedidos recibidos, con filtro por estado y búsqueda
export default function AdminPedidos() {
    const [params, setParams] = useSearchParams();
    const estado = params.get('estado') || '';
    const [busqueda, setBusqueda] = useState(params.get('q') || '');
    const [pedidos, setPedidos] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let activo = true;
        let ocupado = false;
        async function cargar() {
            if (ocupado || document.visibilityState === 'hidden') return;
            ocupado = true;
            try { const lista = await api.pedidosRecibidos({ estado, q: busqueda.trim() }); if (activo) { setPedidos(lista); setError(''); } }
            catch (e) { if (activo) setError(e.message); }
            finally { ocupado = false; }
        }
        const timer = window.setTimeout(cargar, 250);
        const reloj = window.setInterval(cargar, 18000);
        return () => { activo = false; window.clearTimeout(timer); window.clearInterval(reloj); };
    }, [estado, busqueda]);

    function filtrarEstado(nuevo) {
        const siguientes = new URLSearchParams(params);
        if (nuevo) siguientes.set('estado', nuevo);
        else siguientes.delete('estado');
        setParams(siguientes, { replace: true });
    }

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">ADMINISTRACIÓN</div>
                <div className="section-heading">
                    <h1>Pedidos recibidos</h1>
                    <AdminNav />
                </div>

                <div className="catalog-tools">
                    <div className="filters" role="group" aria-label="Filtrar por estado">
                        {['', ...ETAPAS, 'cancelado'].map((e) => (
                            <button key={e || 'todos'} type="button" className={`filter-chip${estado === e ? ' active' : ''}`}
                                aria-pressed={estado === e} onClick={() => filtrarEstado(e)}>
                                {e ? nombreEstado(e) : 'Todos'}
                            </button>
                        ))}
                    </div>
                    <input className="field search" type="search" placeholder="Buscar por N°, cliente o teléfono"
                        aria-label="Buscar pedidos" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>

                {error && <p className="notice error">{error}</p>}
                {!pedidos && !error && <p className="muted">Cargando…</p>}
                {pedidos && (
                    <div className="tabla-contenedor cart-list">
                        <p className="muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
                            {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
                        </p>
                        <table className="tabla">
                            <thead>
                                <tr>
                                    <th>N°</th><th>Fecha</th><th>Cliente</th><th>Entrega</th><th>Estado</th><th>Pago</th>
                                    <th className="num">Productos</th><th className="num">Total</th><th><span className="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pedidos.map((p) => (
                                    <tr key={p.id}>
                                        <td><b>{p.id}</b></td>
                                        <td>{formatearFecha(p.fecha)}</td>
                                        <td>{p.cliente}</td>
                                        <td>{p.metodo_entrega === 'blue' ? 'Blue Express' : 'Metro'}</td>
                                        <td><EstadoBadge estado={p.estado} /></td>
                                        <td><span className={`cf-status-pill cf-payment-${p.metodo_pago === 'transferencia' ? p.estado_pago : 'coordinado'}`}>{nombrePagoPedido(p)}</span></td>
                                        <td className="num">{p.cantidad_productos}</td>
                                        <td className="num">{formatPrice(p.total)}</td>
                                        <td className="num"><Link className="text-link" to={`/admin/pedidos/${p.id}`}>Gestionar →</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {pedidos.length === 0 && <p className="muted" style={{ marginTop: 14 }}>No hay pedidos con estos filtros.</p>}
                    </div>
                )}
            </div>
        </main>
    );
}
