import { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from './ToastContext.jsx';

// El carrito vive en el navegador; al confirmar se envía al servicio de pedidos.
const CART_KEY = 'cfCart';
const CartContext = createContext(null);

function readCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

export function CartProvider({ children }) {
    const [items, setItems] = useState(readCart);
    const showToast = useToast();

    useEffect(() => {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(items));
        } catch {
            // El navegador bloqueó el almacenamiento.
        }
    }, [items]);

    function addItem(product, cantidad = 1) {
        setItems((current) => {
            const existing = current.find((item) => item.id === product.id);
            if (existing) {
                return current.map((item) => item.id === product.id
                    ? { ...item, cantidad: item.cantidad + cantidad }
                    : item);
            }
            return [...current, {
                id: product.id,
                nombre: product.nombre,
                precio: product.precio,
                imagen: product.imagen,
                categoria: product.categoria,
                cantidad
            }];
        });
        showToast(`${product.nombre} se agregó al carrito.`);
    }

    function setQuantity(id, cantidad) {
        const value = Math.max(1, Math.floor(Number(cantidad) || 1));
        setItems((current) => current.map((item) => item.id === id ? { ...item, cantidad: value } : item));
    }

    function removeItem(id) {
        setItems((current) => current.filter((item) => item.id !== id));
    }

    const count = items.reduce((total, item) => total + item.cantidad, 0);
    const subtotal = items.reduce((total, item) => total + item.precio * item.cantidad, 0);

    return (
        <CartContext.Provider value={{
            items, count, subtotal, addItem, setQuantity, removeItem, clear: () => setItems([])
        }}>
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => useContext(CartContext);
