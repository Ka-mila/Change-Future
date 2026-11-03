import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Benefits from '../components/Benefits.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { api } from '../services/api.js';

const benefits = [
    ['⌂', 'Diseño personalizado', 'Adaptamos formas, nombres y medidas a tu idea.'],
    ['✧', 'Fabricación cuidada', 'Revisamos cada detalle durante la impresión 3D.'],
    ['♧', 'Envíos a todo Chile', 'Coordinamos el despacho según tu comuna.'],
    ['♡', 'Te acompañamos', 'Conversamos contigo desde el primer boceto.']
];

export default function Inicio() {
    const [featured, setFeatured] = useState([]);
    const [error, setError] = useState('');
    const logo = useRef(null);

    useEffect(() => {
        api.productos({ destacados: 'true' }).then(setFeatured).catch((e) => setError(e.message));
    }, []);

    function moveLogo(event) {
        const area = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - area.left) / area.width - 0.5;
        const y = (event.clientY - area.top) / area.height - 0.5;
        setLogoPosition(x * 18, y * 12, y * -12, x * 16);
    }

    function setLogoPosition(x, y, rx, ry) {
        const style = logo.current?.style;
        if (!style) return;
        style.setProperty('--logo-x', `${x}px`);
        style.setProperty('--logo-y', `${y}px`);
        style.setProperty('--logo-rx', `${rx}deg`);
        style.setProperty('--logo-ry', `${ry}deg`);
    }

    return (
        <main>
            <section className="hero" onPointerMove={moveLogo} onPointerLeave={() => setLogoPosition(0, 0, 0, 0)}>
                <img ref={logo} className="hero-logo" src="/assets/images/logo-cf-neon.png" alt="Logo Change Future" />
                <div className="wrap hero-grid">
                    <div>
                        <div className="eyebrow">DISEÑO · IMPRESIÓN 3D · PERSONALIZACIÓN</div>
                        <h1>De una idea a un<br /><span className="lime">objeto real.</span></h1>
                        <p className="hero-copy">
                            Creamos piezas funcionales y personalizadas con impresión 3D.
                            Encuentra tu próximo favorito o cuéntanos esa idea que todavía no existe.
                        </p>
                        <div className="hero-actions">
                            <Link className="btn" to="/catalogo">Explorar catálogo&nbsp; →</Link>
                            <Link className="btn secondary" to="/crea-desde-cero">Crear desde cero</Link>
                        </div>
                        <p className="muted" style={{ marginTop: 17, fontSize: 11 }}>
                            Diseño cercano · Fabricación a medida · Envíos a todo Chile
                        </p>
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="wrap">
                    <div className="section-heading">
                        <div>
                            <div className="eyebrow">ELIGE TU FAVORITO</div>
                            <h2>Productos <span className="lime">destacados</span></h2>
                        </div>
                        <Link className="text-link" to="/catalogo">Ver catálogo completo&nbsp; →</Link>
                    </div>
                    {error && <p className="notice">{error}</p>}
                    <div className="product-grid">
                        {featured.map((product) => <ProductCard key={product.id} product={product} />)}
                    </div>
                </div>
            </section>

            <section className="section surface">
                <div className="wrap">
                    <div className="section-heading">
                        <div>
                            <div className="eyebrow">HECHO CON INTENCIÓN</div>
                            <h2>Pequeños detalles, <span className="lime">grandes ideas</span></h2>
                        </div>
                        <p>Una idea puede convertirse en algo que usas todos los días.</p>
                    </div>
                    <Benefits items={benefits} />
                </div>
            </section>

            <section className="section">
                <div className="wrap story-grid">
                    <div>
                        <div className="eyebrow">¿TIENES UNA IDEA?</div>
                        <h2 style={{ fontSize: 36, letterSpacing: -1.5 }}>La imaginamos <span className="lime">contigo.</span></h2>
                        <p className="hero-copy">
                            No necesitas tener un archivo 3D listo. Cuéntanos lo que buscas
                            y te ayudamos a convertirlo en una pieza real.
                        </p>
                        <Link className="btn" to="/crea-desde-cero">Empezar mi proyecto&nbsp; →</Link>
                    </div>
                    <div className="story-image">
                        <img src="/assets/images/product-placeholder.svg" alt="Vista previa de un organizador impreso en 3D" />
                    </div>
                </div>
            </section>
        </main>
    );
}
