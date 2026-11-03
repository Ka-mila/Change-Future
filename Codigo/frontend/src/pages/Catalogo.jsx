import { useEffect, useState } from 'react';
import Benefits from '../components/Benefits.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { api } from '../services/api.js';

const benefits = [
    ['♧', 'Envíos a todo Chile', 'Coordinamos la entrega contigo.'],
    ['◇', 'Compra segura', 'Te explicamos cada paso con claridad.'],
    ['✧', 'Productos de calidad', 'Impresión 3D y terminaciones cuidadas.'],
    ['♡', 'Soporte personalizado', 'Te ayudamos a encontrar lo que buscas.']
];

export default function Catalogo() {
    const [categorias, setCategorias] = useState([]);
    const [productos, setProductos] = useState([]);
    const [categoria, setCategoria] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [orden, setOrden] = useState('recommended');
    const [error, setError] = useState('');

    useEffect(() => {
        api.categorias().then(setCategorias).catch(() => setCategorias([]));
    }, []);

    // El filtrado y el orden los hace el servicio de catálogo.
    useEffect(() => {
        const timer = setTimeout(() => {
            api.productos({ categoria, q: busqueda.trim(), orden })
                .then((rows) => { setProductos(rows); setError(''); })
                .catch((e) => setError(e.message));
        }, 200);
        return () => clearTimeout(timer);
    }, [categoria, busqueda, orden]);

    return (
        <main>
            <section className="hero">
                <div className="wrap hero-grid">
                    <div>
                        <div className="eyebrow">NUESTRO CATÁLOGO</div>
                        <h1>Productos 3D<br /><span className="lime">listos para ti.</span></h1>
                        <p className="hero-copy">
                            Diseños únicos, funcionales y personalizables, hechos con impresión 3D.
                            Encuentra una pieza que se adapte a ti.
                        </p>
                        <div className="search-sort">
                            <input
                                className="field search"
                                type="search"
                                placeholder="Buscar productos..."
                                aria-label="Buscar productos"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                            <span className="muted" style={{ fontSize: 11 }}>Diseños con carácter y propósito</span>
                        </div>
                    </div>
                    <div className="hero-art">
                        <img src="/assets/images/product-placeholder.svg" alt="Vista previa de un macetero geométrico impreso en 3D" />
                        <div className="art-label">TU PRÓXIMA IDEA<b>ESTÁ AQUÍ</b></div>
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="wrap">
                    <div className="catalog-tools">
                        <div className="filters" aria-label="Filtrar por categoría">
                            {[{ id: 0, nombre: '' }, ...categorias].map((c) => (
                                <button
                                    key={c.id}
                                    className={`filter-chip${categoria === c.nombre ? ' active' : ''}`}
                                    onClick={() => setCategoria(c.nombre)}
                                >{c.nombre || 'Todos'}</button>
                            ))}
                        </div>
                        <div className="search-sort">
                            <label className="muted" htmlFor="sort" style={{ fontSize: 12 }}>Ordenar:</label>
                            <select className="field" id="sort" value={orden} onChange={(e) => setOrden(e.target.value)}>
                                <option value="recommended">Recomendados</option>
                                <option value="price-low">Precio: menor a mayor</option>
                                <option value="price-high">Precio: mayor a menor</option>
                                <option value="name">Nombre</option>
                            </select>
                        </div>
                    </div>
                    {error && <p className="notice">{error}</p>}
                    <p className="muted" style={{ margin: '0 0 16px', fontSize: 12 }}>
                        {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
                    </p>
                    <div className="product-grid">
                        {productos.length
                            ? productos.map((p) => <ProductCard key={p.id} product={p} />)
                            : (
                                <div className="empty-state">
                                    <h2>No encontramos productos</h2>
                                    <p>Prueba con otra búsqueda o categoría.</p>
                                </div>
                            )}
                    </div>
                </div>
            </section>

            <section className="section surface">
                <div className="wrap"><Benefits items={benefits} /></div>
            </section>
        </main>
    );
}
