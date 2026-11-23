import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../../components/admin/AdminNav.jsx';
import { api } from '../../services/api.js';
import { formatPrice } from '../../services/format.js';
import { formatearFecha } from '../../services/pedidos.js';
import { formatearRut } from '../../services/validaciones.js';

// HU06.4: clientes registrados con un resumen de sus compras
export default function AdminClientes() {
    const [busqueda, setBusqueda] = useState('');
    const [clientes, setClientes] = useState(null);
    const [pedidos, setPedidos] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        api.pedidosRecibidos().then(setPedidos).catch(() => {});
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            api.clientes(busqueda.trim()).then((lista) => { setClientes(lista); setError(''); }).catch((e) => setError(e.message));
        }, 250);
        return () => clearTimeout(timer);
    }, [busqueda]);

    // Pedidos y monto por cliente (los cancelados no suman al monto)
    const compras = useMemo(() => {
        const resumen = {};
        for (const p of pedidos) {
            if (!p.id_usuario) continue;
            const fila = resumen[p.id_usuario] ||= { pedidos: 0, total: 0, ultimo: null };
            fila.pedidos += 1;
            if (p.estado !== 'cancelado') fila.total += p.total;
            if (!fila.ultimo || p.fecha > fila.ultimo) fila.ultimo = p.fecha;
        }
        return resumen;
    }, [pedidos]);

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">ADMINISTRACIÓN</div>
                <div className="section-heading">
                    <h1>Clientes</h1>
                    <AdminNav />
                </div>
                <div className="catalog-tools">
                    <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                        {clientes ? `${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'}` : ''}
                    </p>
                    <input className="field search" type="search" placeholder="Buscar por nombre, correo, RUT o teléfono"
                        aria-label="Buscar clientes" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>

                {error && <p className="notice error">{error}</p>}
                {!clientes && !error && <p className="muted">Cargando…</p>}
                {clientes && (
                    <div className="tabla-contenedor cart-list">
                        <table className="tabla">
                            <thead>
                                <tr>
                                    <th>Cliente</th><th>RUT</th><th>Correo</th><th>Teléfono</th><th>Registro</th>
                                    <th className="num">Pedidos</th><th className="num">Total comprado</th><th><span className="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {clientes.map((c) => (
                                    <tr key={c.id}>
                                        <td><b>{c.nombre} {c.apellido}</b></td>
                                        <td>{c.rut ? formatearRut(c.rut) : '—'}</td>
                                        <td>{c.correo}</td>
                                        <td>{c.telefono || '—'}</td>
                                        <td>{formatearFecha(c.fecha_registro)}</td>
                                        <td className="num">{compras[c.id]?.pedidos || 0}</td>
                                        <td className="num">{formatPrice(compras[c.id]?.total || 0)}</td>
                                        <td className="num"><Link className="text-link" to={`/admin/clientes/${c.id}`}>Ver ficha →</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {clientes.length === 0 && <p className="muted" style={{ marginTop: 14 }}>No hay clientes que coincidan.</p>}
                    </div>
                )}
            </div>
        </main>
    );
}
