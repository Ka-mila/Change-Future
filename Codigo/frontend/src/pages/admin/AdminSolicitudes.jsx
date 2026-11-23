import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminNav from '../../components/admin/AdminNav.jsx';
import ImagenProtegida from '../../components/admin/ImagenProtegida.jsx';
import { api } from '../../services/api.js';
import { formatPrice } from '../../services/format.js';
import { formatearFecha } from '../../services/pedidos.js';
import { ESTADOS_SOLICITUD, FILTROS_SOLICITUD, SolicitudBadge } from '../../services/solicitudes.jsx';

// HU06.5: solicitudes de "Crea desde cero" con su imagen, características y cliente
export default function AdminSolicitudes() {
    const [params, setParams] = useSearchParams();
    const estado = params.get('estado') || '';
    const [solicitudes, setSolicitudes] = useState(null);
    const [clientes, setClientes] = useState({});
    const [error, setError] = useState('');

    useEffect(() => {
        api.clientes()
            .then((lista) => setClientes(Object.fromEntries(lista.map((c) => [c.id, `${c.nombre} ${c.apellido || ''}`.trim()]))))
            .catch(() => {});
    }, []);

    useEffect(() => {
        setSolicitudes(null);
        api.solicitudesAdmin(estado).then(setSolicitudes).catch((e) => setError(e.message));
    }, [estado]);

    function nombreCliente(s) {
        if (s.id_usuario) return clientes[s.id_usuario] || `Cliente #${s.id_usuario}`;
        return s.contacto?.nombre || 'Sin cuenta';
    }

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">ADMINISTRACIÓN</div>
                <div className="section-heading">
                    <h1>Solicitudes de personalización</h1>
                    <AdminNav />
                </div>

                <div className="filters" role="group" aria-label="Filtrar por estado" style={{ marginBottom: 16 }}>
                    {FILTROS_SOLICITUD.map((e) => (
                        <button key={e || 'todas'} type="button" className={`filter-chip${estado === e ? ' active' : ''}`} aria-pressed={estado === e}
                            onClick={() => setParams(e ? { estado: e } : {}, { replace: true })}>
                            {e ? ESTADOS_SOLICITUD[e].nombre : 'Todas'}
                        </button>
                    ))}
                </div>
                <p className="field-hint" style={{ margin: '0 0 14px' }}>
                    "Todas" no incluye los borradores: diseños que el cliente generó pero no confirmó.
                </p>

                {error && <p className="notice error">{error}</p>}
                {!solicitudes && !error && <p className="muted">Cargando…</p>}
                {solicitudes?.length === 0 && <p className="muted">No hay solicitudes con este estado.</p>}
                {solicitudes?.length > 0 && (
                    <div className="tabla-contenedor cart-list">
                        <table className="tabla">
                            <thead>
                                <tr>
                                    <th><span className="sr-only">Imagen</span></th><th>Fecha</th><th>Cliente</th><th>Proyecto</th>
                                    <th>Características</th><th className="num">Precio</th><th>Estado</th><th><span className="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {solicitudes.map((s) => (
                                    <tr key={s.codigo || s.fecha}>
                                        <td>
                                            <ImagenProtegida className="tabla-miniatura" alt=""
                                                ruta={s.imagen_referencia && `/personalizacion/referencias/${s.imagen_referencia}`} />
                                        </td>
                                        <td>{formatearFecha(s.fecha)}</td>
                                        <td>{nombreCliente(s)}</td>
                                        <td><b>{s.tipo}</b></td>
                                        <td>{s.detalle_item || '—'}</td>
                                        <td className="num">{s.precio ? formatPrice(s.precio) : '—'}</td>
                                        <td><SolicitudBadge estado={s.estado} /></td>
                                        <td className="num">
                                            {s.codigo && <Link className="text-link" to={`/admin/solicitudes/${s.codigo}`}>Gestionar →</Link>}
                                        </td>
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
