import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';
import { formatPrice } from '../services/format.js';

export default function Producto() {
    const { id } = useParams();
    const { addItem } = useCart();
    const [product, setProduct] = useState(null);
    const [status, setStatus] = useState('loading');
    const [cantidad, setCantidad] = useState(1);

    useEffect(() => {
        setStatus('loading');
        api.producto(id)
            .then((data) => { setProduct(data); setStatus('ok'); })
            .catch(() => setStatus('missing'));
    }, [id]);

    return (
        <main className="section">
            <div className="wrap">
                <p style={{ marginBottom: 18 }}>
                    <Link className="muted" to="/catalogo" style={{ fontSize: 12 }}>← Volver al catálogo</Link>
                </p>
                <section className="product-detail">
                    {status === 'missing' && (
                        <div className="empty-state">
                            <div className="empty-icon">?</div>
                            <h1>Producto no encontrado</h1>
                            <p>Puede que el enlace esté incompleto.</p>
                            <Link className="btn" to="/catalogo">Volver al catálogo</Link>
                        </div>
                    )}
                    {status === 'ok' && (
                        <>
                            <div className="detail-photo">
                                <img src={product.imagen} alt={`Vista previa: ${product.nombre}`} />
                            </div>
                            <div className="detail-info">
                                <span className="product-category">{product.categoria.toUpperCase()}</span>
                                <h1>{product.nombre}</h1>
                                <p className="detail-price">{formatPrice(product.precio)}</p>
                                <p className="detail-description">{product.descripcion}</p>
                                <div className="feature-list">
                                    <div><b>Material</b>{product.material}</div>
                                    <div><b>Fabricación</b>Impresión 3D</div>
                                    <div><b>Personalización</b>{product.personalizacion}</div>
                                </div>
                                <label className="form-label" htmlFor="product-quantity">Cantidad</label>
                                <div className="quantity-control">
                                    <button type="button" aria-label="Disminuir cantidad" onClick={() => setCantidad(Math.max(1, cantidad - 1))}>−</button>
                                    <input
                                        id="product-quantity"
                                        type="number"
                                        min="1"
                                        inputMode="numeric"
                                        value={cantidad}
                                        onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
                                    />
                                    <button type="button" aria-label="Aumentar cantidad" onClick={() => setCantidad(cantidad + 1)}>＋</button>
                                </div>
                                <div className="product-actions">
                                    <button className="btn" type="button" onClick={() => addItem(product, cantidad)}>Agregar al carrito</button>
                                    <Link className="btn secondary" to="/crea-desde-cero">Quiero personalizarlo</Link>
                                </div>
                                <p className="muted" style={{ marginTop: 14, fontSize: 11 }}>El envío se coordina según tu comuna.</p>
                            </div>
                        </>
                    )}
                </section>
                <div className="notice" style={{ marginTop: 18 }}>
                    Las imágenes del catálogo son vistas previas para el desarrollo. Sustitúyelas por fotografías reales antes de publicar.
                </div>
            </div>
        </main>
    );
}
