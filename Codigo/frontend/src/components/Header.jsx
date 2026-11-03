import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

const links = [
    { to: '/', label: 'Inicio', end: true },
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/crea-desde-cero', label: 'Crea desde cero' },
    { to: '/nosotros', label: 'Nosotros' }
];

export default function Header() {
    const [open, setOpen] = useState(false);
    const { count } = useCart();
    const { user } = useAuth();

    return (
        <header className="topbar">
            <div className="wrap nav">
                <Link className="brand" to="/">
                    <span className="brand-mark">CF</span>
                    <span>Change <em>Future</em></span>
                </Link>
                <button className="menu-toggle" aria-label="Abrir menú" onClick={() => setOpen(!open)}>☰</button>
                <nav className={`nav-links${open ? ' open' : ''}`} onClick={() => setOpen(false)}>
                    {links.map((link) => (
                        <NavLink key={link.to} to={link.to} end={link.end}>{link.label}</NavLink>
                    ))}
                </nav>
                <div className="nav-actions">
                    <Link className="cart-link" to="/carrito" aria-label="Carrito">
                        🛒 <span className="cart-count">{count}</span>
                    </Link>
                    <Link className="login-link" to="/login">
                        {user ? `Hola, ${user.nombre.split(' ')[0]}` : 'Ingresar'}
                    </Link>
                </div>
            </div>
        </header>
    );
}
