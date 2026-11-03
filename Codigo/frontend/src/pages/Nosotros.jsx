import { Link } from 'react-router-dom';

const PHOTO = 'https://images.unsplash.com/photo-1760894942780-2b4b82a42ac3?auto=format&fit=crop&w=1400&q=85';
const PHOTO_CREDIT = 'https://unsplash.com/photos/3d-printer-head-creating-object-with-purple-and-green-lights-NbJLUsYKUUI';

export default function Nosotros() {
    return (
        <main>
            <section className="hero">
                <div className="wrap hero-grid">
                    <div>
                        <div className="eyebrow">DISEÑO QUE IMPRIME FUTURO</div>
                        <h1>Somos<br /><span className="lime">Change Future.</span></h1>
                        <p className="hero-copy">
                            Un proyecto chileno que transforma ideas en objetos reales a través del diseño y la impresión 3D.
                        </p>
                        <p className="hero-copy">
                            Nos gustan las cosas hechas con intención: piezas útiles, detalles personales y creaciones que tienen algo que contar.
                        </p>
                        <div className="hero-actions">
                            <Link className="btn" to="/crea-desde-cero">Conversemos tu idea&nbsp; →</Link>
                            <Link className="btn secondary" to="/catalogo">Ver catálogo</Link>
                        </div>
                    </div>
                    <div className="hero-art">
                        <img src={PHOTO} alt="Cabezal de impresora 3D fabricando una pieza con iluminación violeta y verde" />
                        <div className="art-label">IDEAS QUE<b>SE VUELVEN REALES</b></div>
                        <div className="photo-credit">
                            Foto: <a href={PHOTO_CREDIT} target="_blank" rel="noopener noreferrer">Jakub Żerdzicki / Unsplash</a>
                        </div>
                    </div>
                </div>
            </section>

            <section className="section surface">
                <div className="wrap story-grid">
                    <div className="story-panel">
                        <div className="eyebrow">NUESTRA HISTORIA</div>
                        <h2 style={{ margin: '15px 0', fontSize: 31 }}>El futuro también se puede <span className="lime">imprimir.</span></h2>
                        <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>
                            Diseño local, fabricación digital y una manera cercana de crear.
                        </p>
                    </div>
                    <div className="story-copy">
                        <div className="eyebrow">LO QUE NOS MUEVE</div>
                        <h2 style={{ margin: '12px 0', fontSize: 34, letterSpacing: -1.5 }}>
                            De una idea sencilla a algo <span className="lime">hecho para ti</span>
                        </h2>
                        <p>
                            Change Future nace de la curiosidad por crear. Vemos la impresión 3D como una forma cercana de resolver problemas,
                            explorar nuevas formas y dar vida a ideas que antes solo existían en la imaginación.
                        </p>
                        <p>
                            Por eso trabajamos cada pedido de manera personalizada: escuchamos lo que necesitas, buscamos la mejor manera de
                            diseñarlo y cuidamos cada detalle de su fabricación.
                        </p>
                        <p>
                            Desde una pieza funcional hasta un regalo especial, queremos que crear algo propio sea un proceso simple, claro y entretenido.
                        </p>
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="wrap">
                    <div className="section-heading">
                        <div><div className="eyebrow">NUESTRO COMPROMISO</div><h2>Lo que ponemos en cada <span className="lime">creación</span></h2></div>
                        <p>La tecnología importa. La dedicación también.</p>
                    </div>
                    <div className="value-grid">
                        <article className="value-card"><i>✦</i><h3>Hecho con intención</h3><p>Creamos piezas pensadas para una persona, un espacio o una necesidad concreta.</p></article>
                        <article className="value-card"><i>⌘</i><h3>Diseño cercano</h3><p>Te acompañamos desde el primer boceto y conversamos cada decisión importante.</p></article>
                        <article className="value-card"><i>◈</i><h3>Fabricación cuidada</h3><p>Revisamos materiales, medidas y terminaciones para cada pieza.</p></article>
                    </div>
                </div>
            </section>

            <section className="section surface">
                <div className="wrap">
                    <div className="section-heading">
                        <div><div className="eyebrow">ASÍ LO HACEMOS</div><h2>Tu idea tiene un <span className="lime">camino</span></h2></div>
                        <p>Un proceso colaborativo, con pasos claros.</p>
                    </div>
                    <div className="why-grid">
                        <article className="why-card"><i>01</i><h3>Nos cuentas</h3><p>Partimos con tu idea, referencia o necesidad.</p></article>
                        <article className="why-card"><i>02</i><h3>Diseñamos</h3><p>Definimos forma, tamaño, materiales y detalles contigo.</p></article>
                        <article className="why-card"><i>03</i><h3>Fabricamos</h3><p>Preparamos el modelo y lo producimos con impresión 3D.</p></article>
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="wrap cart-summary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 22 }}>
                    <div>
                        <h2 style={{ margin: '0 0 7px', fontSize: 25 }}>¿Qué te gustaría crear?</h2>
                        <p className="muted" style={{ margin: 0, fontSize: 12 }}>Cuéntanos esa idea que llevas un tiempo imaginando.</p>
                    </div>
                    <Link className="btn small" to="/crea-desde-cero">Crear desde cero&nbsp; →</Link>
                </div>
            </section>
        </main>
    );
}
