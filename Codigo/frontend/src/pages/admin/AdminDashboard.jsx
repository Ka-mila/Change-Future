import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../../components/admin/AdminNav.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import { BarrasRanking, formatoCompacto, GraficoColumnas, StatTile, TablaDatos } from '../../components/admin/Graficos.jsx';
import { api } from '../../services/api.js';
import { formatPrice } from '../../services/format.js';
import { ETAPAS } from '../../services/pedidos.js';

const METRICAS = {
    pedidos: { nombre: 'Pedidos', formato: (v) => v.toLocaleString('es-CL') },
    ventas: { nombre: 'Ventas', formato: (v, corto) => (corto ? formatoCompacto(v, true) : formatPrice(v)) }
};
const POR_ATENDER = ['pendiente', 'confirmado', 'en_produccion'];

export default function AdminDashboard() {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState('');
    const [meses, setMeses] = useState(6);
    const [metrica, setMetrica] = useState('pedidos');

    useEffect(() => {
        api.estadisticas(meses).then(setDatos).catch((e) => setError(e.message));
    }, [meses]);

    const formatoMetrica = METRICAS[metrica].formato;
    const dineroCorto = (v, corto) => (corto ? formatoCompacto(v, true) : formatPrice(v));

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">ADMINISTRACIÓN</div>
                <div className="section-heading">
                    <h1>Dashboard</h1>
                    <AdminNav />
                </div>
                {error && <p className="notice error">{error}</p>}
                {!datos && !error && <p className="muted">Cargando…</p>}

                {datos && (() => {
                    const { comparacion } = datos;
                    const textoPeriodo = `vs. los primeros ${comparacion.dias} días de ${datos.mes_anterior.etiqueta}`;
                    const porAtender = POR_ATENDER.reduce((total, e) => total + (datos.por_estado[e] || 0), 0);
                    const serie = datos.por_mes.map((m, i) => ({
                        etiqueta: m.etiqueta.split(' ')[0],
                        valor: m[metrica],
                        destacado: i === datos.por_mes.length - 1
                    }));

                    return (
                        <>
                            <section className="kpi-row" aria-label="Indicadores principales">
                                <StatTile etiqueta={`Pedidos de ${datos.mes_actual.etiqueta}`} valor={comparacion.actual.pedidos.toLocaleString('es-CL')}
                                    actual={comparacion.actual.pedidos} anterior={comparacion.anterior.pedidos} comparacion={textoPeriodo} />
                                <StatTile etiqueta={`Ventas de ${datos.mes_actual.etiqueta}`} valor={formatPrice(comparacion.actual.ventas)}
                                    actual={comparacion.actual.ventas} anterior={comparacion.anterior.ventas} comparacion={textoPeriodo} />
                                <StatTile etiqueta="Ticket promedio" valor={formatPrice(datos.ticket_promedio)}
                                    nota={`Por pedido, últimos ${datos.periodo_meses} meses`} />
                                <StatTile etiqueta="Pedidos por atender" valor={porAtender.toLocaleString('es-CL')}
                                    nota={<Link className="text-link" to="/admin/pedidos?estado=pendiente">{datos.por_estado.pendiente || 0} pendientes de confirmar →</Link>} />
                            </section>

                            <div className="filtros-dashboard">
                                <div className="filters" role="group" aria-label="Métrica">
                                    {Object.entries(METRICAS).map(([clave, m]) => (
                                        <button key={clave} type="button" className={`filter-chip${metrica === clave ? ' active' : ''}`}
                                            aria-pressed={metrica === clave} onClick={() => setMetrica(clave)}>{m.nombre}</button>
                                    ))}
                                </div>
                                <label className="muted" style={{ fontSize: 12 }}>
                                    Período:{' '}
                                    <select className="field" style={{ width: 'auto', display: 'inline-block' }} value={meses}
                                        onChange={(e) => setMeses(Number(e.target.value))}>
                                        <option value={3}>Últimos 3 meses</option>
                                        <option value={6}>Últimos 6 meses</option>
                                        <option value={12}>Últimos 12 meses</option>
                                    </select>
                                </label>
                            </div>

                            <div className="dashboard-grid">
                                <section className="cart-list">
                                    <h2 className="summary-title">{METRICAS[metrica].nombre} por mes</h2>
                                    <p className="form-hint">Mes actual destacado (en curso). No incluye pedidos cancelados.</p>
                                    <GraficoColumnas datos={serie} formato={formatoMetrica}
                                        titulo={`${METRICAS[metrica].nombre} por mes, últimos ${datos.periodo_meses} meses`} />
                                    <TablaDatos columnas={['Mes', 'Pedidos', 'Ventas']}
                                        filas={datos.por_mes.map((m) => [m.etiqueta, m.pedidos, formatPrice(m.ventas)])} />
                                </section>

                                <section className="cart-list">
                                    <h2 className="summary-title">Ventas por categoría</h2>
                                    <p className="form-hint">Últimos {datos.periodo_meses} meses, de mayor a menor.</p>
                                    {datos.por_categoria.length
                                        ? <BarrasRanking formato={dineroCorto}
                                            datos={datos.por_categoria.map((c) => ({ nombre: c.nombre, valor: c.ventas, detalle: `${c.unidades} unidades` }))} />
                                        : <p className="muted">Aún no hay ventas en este período.</p>}
                                    <TablaDatos columnas={['Categoría', 'Unidades', 'Ventas']}
                                        filas={datos.por_categoria.map((c) => [c.nombre, c.unidades, formatPrice(c.ventas)])} />
                                </section>

                                <section className="cart-list">
                                    <h2 className="summary-title">Productos más vendidos</h2>
                                    <table className="tabla">
                                        <thead><tr><th>Producto</th><th className="num">Unidades</th><th className="num">Ventas</th></tr></thead>
                                        <tbody>
                                            {datos.top_productos.map((p) => (
                                                <tr key={p.nombre}><td>{p.nombre}</td><td className="num">{p.unidades}</td><td className="num">{formatPrice(p.ventas)}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {!datos.top_productos.length && <p className="muted">Aún no hay ventas en este período.</p>}
                                </section>

                                <section className="cart-list">
                                    <h2 className="summary-title">Pedidos por estado</h2>
                                    <p className="form-hint">Todos los pedidos registrados.</p>
                                    <ul className="estados-lista">
                                        {[...ETAPAS, 'cancelado'].map((estado) => (
                                            <li key={estado}>
                                                <Link to={`/admin/pedidos?estado=${estado}`}>
                                                    <EstadoBadge estado={estado} />
                                                    <b>{datos.por_estado[estado] || 0}</b>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            </div>
                        </>
                    );
                })()}
            </div>
        </main>
    );
}
