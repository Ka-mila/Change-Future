import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../../components/admin/AdminNav.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import { formatPrice } from '../../services/format.js';

// HU06.1 a HU06.3: lista de productos con acciones para editar y deshabilitar
export default function AdminProductos() {
    const showToast = useToast();
    const [productos, setProductos] = useState(null);
    const [filtro, setFiltro] = useState('todos');
    const [busqueda, setBusqueda] = useState('');
    const [error, setError] = useState('');
    const [cambiando, setCambiando] = useState(null);

    useEffect(() => {
        api.productosAdmin().then(setProductos).catch((e) => setError(e.message));
    }, []);

    async function alternar(producto) {
        const activar = !producto.activo;
        if (!activar && !window.confirm(`¿Deshabilitar "${producto.nombre}"? Dejará de aparecer en el catálogo y no se podrá comprar.`)) {
            return;
        }
        setCambiando(producto.id);
        try {
            const actualizado = await api.cambiarEstadoProducto(producto.id, activar);
            setProductos((lista) => lista.map((p) => (p.id === actualizado.id ? actualizado : p)));
            showToast(activar ? `"${producto.nombre}" vuelve a estar a la venta.` : `"${producto.nombre}" quedó deshabilitado.`);
        } catch (e) {
            showToast(e.message);
        } finally {
            setCambiando(null);
        }
    }

    const texto = busqueda.trim().toLocaleLowerCase('es');
    const visibles = (productos || []).filter((p) =>
        (filtro === 'todos' || (filtro === 'activos') === p.activo)
        && `${p.nombre} ${p.categoria}`.toLocaleLowerCase('es').includes(texto));
    const inactivos = (productos || []).filter((p) => !p.activo).length;

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">ADMINISTRACIÓN</div>
                <div className="section-heading">
                    <h1>Productos</h1>
                    <AdminNav />
                </div>

                <div className="catalog-tools">
                    <div className="filters" role="group" aria-label="Filtrar productos">
                        {[['todos', 'Todos'], ['activos', 'A la venta'], ['inactivos', `Deshabilitados (${inactivos})`]].map(([clave, nombre]) => (
                            <button key={clave} type="button" className={`filter-chip${filtro === clave ? ' active' : ''}`}
                                aria-pressed={filtro === clave} onClick={() => setFiltro(clave)}>{nombre}</button>
                        ))}
                    </div>
                    <div className="search-sort">
                        <input className="field search" type="search" placeholder="Buscar producto o categoría" aria-label="Buscar productos"
                            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                        <Link className="btn small" to="/admin/productos/nuevo">＋ Nuevo producto</Link>
                    </div>
                </div>

                {error && <p className="notice error">{error}</p>}
                {!productos && !error && <p className="muted">Cargando…</p>}
                {productos && (
                    <div className="tabla-contenedor cart-list">
                        <table className="tabla">
                            <thead>
                                <tr>
                                    <th><span className="sr-only">Imagen</span></th><th>Producto</th><th>Categoría</th>
                                    <th className="num">Precio</th><th className="num">Stock</th><th>Estado</th><th><span className="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((p) => (
                                    <tr key={p.id} className={p.activo ? '' : 'fila-inactiva'}>
                                        <td><img className="tabla-miniatura" src={p.imagen} alt="" /></td>
                                        <td><b>{p.nombre}</b>{p.destacado && <small className="muted"> · Destacado</small>}</td>
                                        <td>{p.categoria}</td>
                                        <td className="num">{formatPrice(p.precio)}</td>
                                        <td className="num">{p.stock}</td>
                                        <td>
                                            <span className={`estado-badge ${p.activo ? 'estado-entregado' : 'estado-cancelado'}`}>
                                                <span aria-hidden="true">{p.activo ? '●' : '○'}</span> {p.activo ? 'A la venta' : 'Deshabilitado'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="acciones">
                                                <Link className="text-link" to={`/admin/productos/${p.id}`}>Editar</Link>
                                                <button className="text-link" type="button" disabled={cambiando === p.id} onClick={() => alternar(p)}>
                                                    {p.activo ? 'Deshabilitar' : 'Habilitar'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {visibles.length === 0 && <p className="muted" style={{ marginTop: 14 }}>No hay productos con estos filtros.</p>}
                        <p className="field-hint" style={{ marginTop: 14 }}>
                            Los productos deshabilitados no aparecen en el catálogo ni se pueden comprar, pero no se borran:
                            los pedidos antiguos conservan su nombre y precio, y se pueden volver a habilitar.
                        </p>
                    </div>
                )}
            </div>
        </main>
    );
}
