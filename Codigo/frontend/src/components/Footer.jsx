import { Link } from 'react-router-dom';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="wrap">
                <div className="footer-top">
                    <Link className="brand" to="/">
                        <span className="brand-mark">CF</span>
                        <span>Change <em>Future</em></span>
                    </Link>
                    <nav className="footer-links">
                        <Link to="/">Inicio</Link>
                        <Link to="/catalogo">Catálogo</Link>
                        <Link to="/crea-desde-cero">Crea desde cero</Link>
                        <Link to="/nosotros">Nosotros</Link>
                        <Link to="/carrito">Carrito</Link>
                    </nav>
                    <span>Impresión 3D · Diseño · Personalización</span>
                </div>
                <div className="footer-bottom">
                    <span>© 2026 Change Future. Todos los derechos reservados.</span>
                    <span>Hecho en Chile, pensado para ti.</span>
                </div>
            </div>
        </footer>
    );
}
