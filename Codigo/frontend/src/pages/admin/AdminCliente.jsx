import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminNav from '../../components/admin/AdminNav.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import { api } from '../../services/api.js';
import { formatPrice } from '../../services/format.js';
import { formatearFecha } from '../../services/pedidos.js';
import { formatearRut } from '../../services/validaciones.js';

// HU06.4: ficha del cliente con sus pedidos, para gestionarlos
export default function AdminCliente() {
    const { id } = useParams();
    const [cliente, setCliente] = useState(null);
    const [pedidos, setPedidos] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.cliente(id).then(setCliente).catch((e) => setError(e.message));
        api.pedidosRecibidos({ usuario: id }).then(setPedidos).catch(() => setPedidos([]));
    }, [id]);

    const validos = (pedidos || []).filter((p) => p.estado !== 'cancelado');
    const total = validos.reduce((suma, p) => suma + p.total, 0);

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">ADMINISTRACIÓN · CLIENTES</div>
                <div className="section-heading">
                    <h1>{cliente ? `${cliente.nombre} ${cliente.apellido || ''}` : 'Cliente'}</h1>
                    <AdminNav />
                </div>
                <p style={{ margin: '-12px 0 18px' }}><Link className="text-link" to="/admin/clientes">← Volver a clientes</Link></p>
                {error && <p className="notice error">{error}</p>}

                {cliente && (
                    <div className="pedido-layout">
                        <section className="cart-list">
                            <h2 className="summary-title">Pedidos</h2>
                            {!pedidos && <p className="muted">Cargando…</p>}
                            {pedidos?.length === 0 && <p className="muted">Este cliente todavía no tiene pedidos.</p>}
                            {pedidos?.length > 0 && (
                                <div className="tabla-contenedor">
                                <table className="tabla">
                                    <thead><tr><th>N°</th><th>Fecha</th><th>Estado</th><th className="num">Total</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                                    <tbody>
                                        {pedidos.map((p) => (
                                            <tr key={p.id}>
                                                <td><b>{p.id}</b></td>
                                                <td>{formatearFecha(p.fecha)}</td>
                                                <td><EstadoBadge estado={p.estado} /></td>
                                                <td className="num">{formatPrice(p.total)}</td>
                                                <td className="num"><Link className="text-link" to={`/admin/pedidos/${p.id}`}>Gestionar →</Link></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            )}
                        </section>
                        <aside className="cart-summary">
                            <h2 className="summary-title">Datos del cliente</h2>
                            <div className="summary-row"><span>RUT</span><b>{cliente.rut ? formatearRut(cliente.rut) : '—'}</b></div>
                            <div className="summary-row"><span>Correo</span><b><a href={`mailto:${cliente.correo}`}>{cliente.correo}</a></b></div>
                            <div className="summary-row"><span>Teléfono</span><b>{cliente.telefono || '—'}</b></div>
                            <div className="summary-row"><span>Cliente desde</span><b>{formatearFecha(cliente.fecha_registro)}</b></div>
                            <div className="summary-row"><span>Cuenta</span><b>{cliente.estado === 'activo' ? 'Activa' : cliente.estado}</b></div>
                            <h3 className="summary-subtitle">Compras</h3>
                            <div className="summary-row"><span>Pedidos</span><b>{pedidos?.length ?? '…'}</b></div>
                            <div className="summary-row"><span>Total comprado</span><b>{formatPrice(total)}</b></div>
                            <div className="summary-row"><span>Ticket promedio</span><b>{validos.length ? formatPrice(Math.round(total / validos.length)) : '—'}</b></div>
                        </aside>
                    </div>
                )}
            </div>
        </main>
    );
}
