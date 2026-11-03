import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { formatPrice } from '../services/format.js';

export default function ProductCard({ product }) {
    const { addItem } = useCart();

    return (
        <article className="product-card">
            <Link className="product-photo" to={`/producto/${product.id}`}>
                <img src={product.imagen} alt={`Vista previa: ${product.nombre}`} />
                <span className="product-tag">{product.categoria}</span>
            </Link>
            <div className="product-info">
                <h3>{product.nombre}</h3>
                <p>{product.descripcion}</p>
                <span className="price">{formatPrice(product.precio)}</span>
                <div className="product-bottom">
                    <button
                        className="icon-button"
                        type="button"
                        aria-label={`Agregar ${product.nombre} al carrito`}
                        onClick={() => addItem(product)}
                    >＋</button>
                    <Link className="text-link" to={`/producto/${product.id}`}>Ver producto&nbsp; →</Link>
                </div>
            </div>
        </article>
    );
}
