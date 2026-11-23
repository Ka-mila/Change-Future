import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Campo from '../components/Campo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';
import { formatPrice } from '../services/format.js';
import { errorTelefono } from '../services/validaciones.js';
import '../styles/checkout.css';

const ESTACIONES = ['Rojas Magallanes', 'Bellavista de La Florida'];

function validarEntrega(entrega) {
    const errores = {
        nombre: entrega.nombre.trim() ? '' : 'Ingresa tu nombre',
        telefono: !entrega.telefono.trim() ? 'Ingresa tu teléfono' : errorTelefono(entrega.telefono),
        metodo: entrega.metodo ? '' : 'Elige cómo quieres recibir tu pedido'
    };
    if (entrega.metodo === 'blue') {
        errores.region = entrega.region ? '' : 'Elige tu región';
        errores.comuna = entrega.comuna.trim() ? '' : 'Ingresa tu comuna';
        errores.direccion = entrega.direccion.trim() ? '' : 'Ingresa tu dirección';
    }
    if (entrega.metodo === 'metro') {
        errores.estacion = entrega.estacion ? '' : 'Elige una estación';
    }
    return Object.fromEntries(Object.entries(errores).filter(([, mensaje]) => mensaje));
}

// Los errores del servidor usan otros nombres de campo
const CAMPOS_SERVIDOR = { nombre_cliente: 'nombre', telefono_cliente: 'telefono', metodo_entrega: 'metodo' };

function LineaProducto({ item, editable, setQuantity, removeItem, noDisponible }) {
    return (
        <article className={`cart-row${noDisponible ? ' no-disponible' : ''}`}>
            <Link className="cart-thumb" to={item.codigo_solicitud ? '/crea-desde-cero' : `/producto/${item.id}`}>
                <img src={item.imagen} alt={`Vista previa: ${item.nombre}`} />
            </Link>
            <div className="cart-name">
                {item.nombre}
                <small>{item.categoria}</small>
                <small>{formatPrice(item.precio)} por unidad</small>
                {noDisponible && <small className="field-error">Ya no está disponible. Quítalo para continuar.</small>}
            </div>
            {editable ? (
                <div className="quantity-control">
                    <button type="button" aria-label={`Disminuir cantidad de ${item.nombre}`} disabled={item.cantidad <= 1}
                        onClick={() => setQuantity(item.id, item.cantidad - 1)}>−</button>
                    <input type="number" min="1" max="99" value={item.cantidad} aria-label={`Cantidad de ${item.nombre}`}
                        onChange={(e) => setQuantity(item.id, Math.min(99, e.target.value))} />
                    <button type="button" aria-label={`Aumentar cantidad de ${item.nombre}`} disabled={item.cantidad >= 99}
                        onClick={() => setQuantity(item.id, item.cantidad + 1)}>＋</button>
                </div>
            ) : (
                <div className="cart-qty-fija">× {item.cantidad}</div>
            )}
            <div className="cart-line-total" aria-label={`Subtotal de ${item.nombre}`}>{formatPrice(item.precio * item.cantidad)}</div>
            {editable && (
                <button className="remove-button" type="button" aria-label={`Eliminar ${item.nombre}`} onClick={() => removeItem(item.id)}>×</button>
            )}
        </article>
    );
}

export default function Carrito() {
    const { items, count, subtotal, setQuantity, removeItem, clear } = useCart();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [paso, setPaso] = useState('carrito'); // carrito -> revisar
    const [entrega, setEntrega] = useState(() => ({
        nombre: user ? [user.nombre, user.apellido].filter(Boolean).join(' ') : '',
        telefono: user?.telefono || '',
        metodo: '', region: '', comuna: '', direccion: '', referencia: '', estacion: '', horario: '', observacion: ''
    }));
    const [errores, setErrores] = useState({});
    const [opciones, setOpciones] = useState(null);
    const [errorOpciones, setErrorOpciones] = useState('');
    const [cotizacion, setCotizacion] = useState(null);
    const [cotizando, setCotizando] = useState(false);
    const [errorCotizacion, setErrorCotizacion] = useState('');
    const [revisando, setRevisando] = useState(false);
    const [aceptado, setAceptado] = useState(false);
    const bloqueoEnvio = useRef(false);
    const intencion = useRef(null);

    async function cargarOpciones() {
        setErrorOpciones('');
        try { setOpciones(await api.checkoutOpciones()); }
        catch (e) { setErrorOpciones(e.message); }
    }
    useEffect(() => { cargarOpciones(); }, []);

    // Si la sesión se recupera después de abrir la página, completar nombre y teléfono
    useEffect(() => {
        if (!user) return;
        setEntrega((actual) => ({
            ...actual,
            nombre: actual.nombre || [user.nombre, user.apellido].filter(Boolean).join(' '),
            telefono: actual.telefono || user.telefono || ''
        }));
    }, [user]);
    const [enviando, setEnviando] = useState(false);
    const [errorGeneral, setErrorGeneral] = useState('');
    // Productos del carrito que el administrador deshabilitó después de agregarlos
    const [noDisponibles, setNoDisponibles] = useState([]);

    const itemsServidor = items.map((item) => item.codigo_solicitud
        ? { codigo_solicitud: item.codigo_solicitud, cantidad: item.cantidad }
        : { id_producto: item.id, cantidad: item.cantidad });
    const detalleEntrega = entrega.metodo === 'blue'
        ? { region: entrega.region, comuna: entrega.comuna.trim(), direccion: entrega.direccion.trim(), referencia: entrega.referencia.trim() }
        : { estacion: entrega.estacion, horario: entrega.horario.trim() };
    const claveCotizacion = JSON.stringify({
        items: itemsServidor, metodo_entrega: entrega.metodo,
        detalle_entrega: entrega.metodo === 'blue'
            ? { region: entrega.region, comuna: entrega.comuna.trim() }
            : { estacion: entrega.estacion }
    });
    const puedeCotizar = Boolean(user && items.length && (
        entrega.metodo === 'metro' && entrega.estacion
        || entrega.metodo === 'blue' && entrega.region && entrega.comuna.trim().length >= 2
    ));
    const actual = cotizacion?.clave === claveCotizacion ? cotizacion.datos : null;

    useEffect(() => {
        setAceptado(false);
        if (paso !== 'carrito') return undefined;
        if (!puedeCotizar) { setCotizando(false); setErrorCotizacion(''); return undefined; }
        let activo = true;
        setCotizando(true);
        setErrorCotizacion('');
        const temporizador = window.setTimeout(async () => {
            try {
                const datos = await api.cotizarPedido(JSON.parse(claveCotizacion));
                if (activo) setCotizacion({ clave: claveCotizacion, datos });
            } catch (e) { if (activo) setErrorCotizacion(e.message); }
            finally { if (activo) setCotizando(false); }
        }, 550);
        return () => { activo = false; window.clearTimeout(temporizador); };
    }, [claveCotizacion, puedeCotizar, paso]);

    const idsProductos = items.filter((item) => !item.codigo_solicitud).map((item) => item.id).join(',');
    useEffect(() => {
        let activo = true;
        if (!idsProductos) { setNoDisponibles([]); return undefined; }
        Promise.all(idsProductos.split(',').map((id) => api.producto(id)
            .then(() => null)
            .catch((e) => (e.status === 404 ? Number(id) : null))))
            .then((resultado) => activo && setNoDisponibles(resultado.filter(Boolean)));
        return () => { activo = false; };
    }, [idsProductos]);

    function cambiar(event) {
        const { name, value } = event.target;
        setEntrega((actual) => ({ ...actual, [name]: value }));
        setErrores((actual) => ({ ...actual, [name]: '' }));
        setAceptado(false);
        setErrorGeneral('');
    }

    // HU04.4: antes de confirmar se revisa un resumen completo
    async function revisar(event) {
        event.preventDefault();
        if (revisando) return;
        if (noDisponibles.some((id) => items.some((item) => item.id === id))) {
            setErrorGeneral('Hay productos que ya no están disponibles. Quítalos del carrito para continuar.');
            return;
        }
        const encontrados = validarEntrega(entrega);
        setErrores(encontrados);
        if (Object.keys(encontrados).length) return;
        setRevisando(true);
        setErrorGeneral('');
        try {
            const datos = await api.cotizarPedido({ items: itemsServidor, metodo_entrega: entrega.metodo, detalle_entrega: detalleEntrega });
            setCotizacion({ clave: claveCotizacion, datos });
            setAceptado(false);
            setPaso('revisar');
            window.scrollTo(0, 0);
        } catch (e) { setErrorGeneral(e.message); }
        finally { setRevisando(false); }
    }

    // HU04.5: registrar el pedido y mostrar la confirmación
    async function confirmar() {
        if (bloqueoEnvio.current || !actual || !aceptado) return;
        bloqueoEnvio.current = true;
        setEnviando(true);
        setErrorGeneral('');
        try {
            const datos = {
                nombre_cliente: entrega.nombre,
                telefono_cliente: entrega.telefono,
                metodo_entrega: entrega.metodo,
                detalle_entrega: detalleEntrega,
                observacion: entrega.observacion,
                metodo_pago: 'transferencia',
                total_aceptado: actual.total,
                items: itemsServidor
            };
            const huella = JSON.stringify(datos);
            if (intencion.current?.huella !== huella) {
                const clave = window.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                    const n = Math.floor(Math.random() * 16);
                    return (c === 'x' ? n : (n & 3) | 8).toString(16);
                });
                intencion.current = { huella, clave };
            }
            const pedido = await api.crearPedido({ ...datos, clave_idempotencia: intencion.current.clave });
            clear();
            navigate(`/mis-pedidos/${pedido.id}`, { replace: true, state: { recienRegistrado: true } });
        } catch (e) {
            if (e.status === 409 && e.data?.cotizacion) {
                setCotizacion({ clave: claveCotizacion, datos: e.data.cotizacion });
                setAceptado(false);
            }
            const campos = Object.fromEntries(Object.entries(e.campos || {}).map(([k, v]) => [CAMPOS_SERVIDOR[k] || k, v]));
            if (Object.keys(campos).length) {
                setErrores(campos);
                setPaso('carrito');
            }
            setErrorGeneral(e.message);
        } finally {
            setEnviando(false);
            bloqueoEnvio.current = false;
        }
    }

    if (items.length === 0) {
        return (
            <main className="section">
                <div className="wrap">
                    <div className="eyebrow">TU PEDIDO</div>
                    <h1>Tu <span className="lime">carrito</span></h1>
                    <section className="empty-state cart-list">
                        <div className="empty-icon">🛒</div>
                        <h2>Tu carrito está vacío</h2>
                        <p>Cuando encuentres algo que te guste, agrégalo aquí.</p>
                        <Link className="btn" to="/catalogo">Explorar catálogo&nbsp; →</Link>
                    </section>
                </div>
            </main>
        );
    }

    const campo = (id) => ({ id, value: entrega[id], onChange: cambiar, error: errores[id] });
    const itemsResumen = items.map((item) => {
        const linea = actual?.items?.find((r) => item.codigo_solicitud
            ? r.codigo_solicitud === item.codigo_solicitud : String(r.id_producto) === String(item.id));
        return linea ? { ...item, precio: linea.precio_unitario, nombre: linea.nombre || item.nombre } : item;
    });
    const resumenTotales = (
        <>
            <div className="summary-row"><span>Productos ({count} {count === 1 ? 'unidad' : 'unidades'})</span><b>{formatPrice(actual?.subtotal ?? subtotal)}</b></div>
            <div className="summary-row"><span>{entrega.metodo === 'metro' ? 'Entrega en Metro' : 'Despacho estimado'}</span><b>{cotizando && paso === 'carrito' ? 'Calculando…' : actual ? formatPrice(actual.costo_envio) : 'Elige tu entrega'}</b></div>
            <div className="summary-row total"><span>Total del pedido</span><b aria-live="polite">{actual ? formatPrice(actual.total) : 'Por calcular'}</b></div>
            {actual?.envio?.simulado && <p className="cf-simulation-note"><b>Simulación de despacho</b>Desde La Florida · talla estimada {actual.envio.talla}. Valores de demostración, sujetos a validación; no son tarifas oficiales de Blue Express.</p>}
            {errorCotizacion && paso === 'carrito' && <p className="notice error" role="alert">{errorCotizacion}</p>}
        </>
    );

    if (paso === 'revisar') {
        return (
            <main className="section">
                <div className="wrap">
                    <div className="eyebrow">PASO 2 DE 2</div>
                    <div className="section-heading">
                        <h1>Revisa tu <span className="lime">pedido</span></h1>
                        <button className="text-link" type="button" onClick={() => setPaso('carrito')}>← Editar carrito o entrega</button>
                    </div>
                    <div className="cart-layout">
                        <section className="cart-list">
                            <h2 className="summary-title">Productos</h2>
                            {itemsResumen.map((item) => <LineaProducto key={item.id} item={item} />)}
                        </section>
                        <aside className="cart-summary">
                            <h2 className="summary-title">Resumen</h2>
                            {resumenTotales}
                            <h3 className="summary-subtitle">Entrega</h3>
                            <div className="summary-row"><span>Nombre</span><b>{entrega.nombre}</b></div>
                            <div className="summary-row"><span>Teléfono</span><b>{entrega.telefono}</b></div>
                            {entrega.metodo === 'blue' ? (
                                <>
                                    <div className="summary-row"><span>Despacho</span><b>Blue Express</b></div>
                                    <div className="summary-row"><span>Región</span><b>{actual?.envio?.region_nombre || opciones?.regiones?.find((r) => r.codigo === entrega.region)?.nombre || entrega.region}</b></div>
                                    <div className="summary-row"><span>Dirección</span><b>{entrega.direccion}, {entrega.comuna}</b></div>
                                </>
                            ) : (
                                <>
                                    <div className="summary-row"><span>Entrega en Metro</span><b>{entrega.estacion}</b></div>
                                    {entrega.horario && <div className="summary-row"><span>Horario</span><b>{entrega.horario}</b></div>}
                                </>
                            )}
                            <div className="cf-checkout-payment"><span className="cf-kicker">FORMA DE PAGO</span><b>Transferencia bancaria</b><p>Al registrar el pedido verás los datos para transferir y podrás adjuntar tu comprobante. El equipo revisará el pago.</p></div>
                            <label className="cf-accept-total"><input type="checkbox" checked={aceptado} onChange={(e) => setAceptado(e.target.checked)} /><span>Revisé los productos, la entrega y el total de <b>{formatPrice(actual?.total || 0)}</b>{actual?.envio?.simulado ? ', incluido el despacho simulado que será validado por Change Future' : ''}.</span></label>
                            {errorGeneral && <p className="notice error" role="alert">{errorGeneral}</p>}
                            <button className="btn login-submit" type="button" onClick={confirmar} disabled={enviando || !aceptado || !actual}>
                                {enviando ? 'Registrando…' : <>Registrar pedido y ver pago&nbsp; →</>}
                            </button>
                        </aside>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">PASO 1 DE 2</div>
                <div className="section-heading">
                    <h1>Tu <span className="lime">carrito</span></h1>
                    <Link className="text-link" to="/catalogo">← Seguir viendo productos</Link>
                </div>

                <div className="cart-layout">
                    <section className="cart-list">
                        <h2 className="summary-title">Productos seleccionados</h2>
                        {items.map((item) => (
                            <LineaProducto key={item.id} item={item} editable setQuantity={setQuantity} removeItem={removeItem}
                                noDisponible={noDisponibles.includes(item.id)} />
                        ))}
                    </section>

                    <aside className="cart-summary">
                        <h2 className="summary-title">Resumen del pedido</h2>
                        {resumenTotales}

                        {!user ? (
                            <div className="notice" style={{ marginTop: 16 }}>
                                <p style={{ margin: '0 0 12px' }}>Ingresa para calcular la entrega, registrar tu pedido y seguir su avance.</p>
                                <Link className="btn small" to="/login" state={{ desde: '/carrito' }}>Ingresar o crear cuenta</Link>
                            </div>
                        ) : (
                            <form className="order-form" onSubmit={revisar} noValidate>
                                <h3 className="summary-subtitle">Datos de entrega</h3>
                                <Campo {...campo('nombre')} label="Tu nombre" autoComplete="name" placeholder="Nombre completo" />
                                <Campo {...campo('telefono')} label="Tu teléfono" type="tel" autoComplete="tel" placeholder="+56 9 1234 5678" />

                                <label className="form-label" htmlFor="metodo">¿Cómo quieres recibirlo?</label>
                                <select className={`field${errores.metodo ? ' invalid' : ''}`} id="metodo" name="metodo" value={entrega.metodo} onChange={cambiar}>
                                    <option value="">Elige una opción</option>
                                    <option value="blue">Despacho Blue Express</option>
                                    <option value="metro">Entrega en Metro</option>
                                </select>
                                {errores.metodo && <p className="field-error">{errores.metodo}</p>}

                                {entrega.metodo === 'blue' && (
                                    <>
                                        <label className="form-label" htmlFor="region">Región de destino</label>
                                        <select className={`field${errores.region ? ' invalid' : ''}`} id="region" name="region" value={entrega.region} onChange={cambiar} disabled={!opciones}>
                                            <option value="">{opciones ? 'Elige tu región' : 'Cargando regiones…'}</option>
                                            {opciones?.regiones?.map((r) => <option key={r.codigo} value={r.codigo}>{r.nombre}</option>)}
                                        </select>
                                        {errores.region && <p className="field-error">{errores.region}</p>}
                                        {errorOpciones && <p className="notice error">{errorOpciones} <button className="text-link" type="button" onClick={cargarOpciones}>Volver a cargar regiones</button></p>}
                                        <Campo {...campo('comuna')} label="Comuna" placeholder="Tu comuna" />
                                        <Campo {...campo('direccion')} label="Dirección" autoComplete="street-address" placeholder="Calle y número" />
                                        <Campo {...campo('referencia')} label="Referencia (opcional)" placeholder="Casa, departamento u otra referencia" />
                                    </>
                                )}
                                {entrega.metodo === 'metro' && (
                                    <>
                                        <label className="form-label" htmlFor="estacion">Estación</label>
                                        <select className={`field${errores.estacion ? ' invalid' : ''}`} id="estacion" name="estacion" value={entrega.estacion} onChange={cambiar}>
                                            <option value="">Elige una estación</option>
                                            {ESTACIONES.map((estacion) => <option key={estacion}>{estacion}</option>)}
                                        </select>
                                        {errores.estacion && <p className="field-error">{errores.estacion}</p>}
                                        <Campo {...campo('horario')} label="Horario que prefieres (opcional)" placeholder="Ej.: sábado por la tarde" />
                                    </>
                                )}
                                <Campo {...campo('observacion')} label="Comentarios (opcional)" placeholder="Algo que debamos saber" />
                                <p className="cf-private-note">Pago por transferencia. Podrás adjuntar el comprobante después de revisar y registrar el pedido.</p>
                                {errorGeneral && <p className="notice error" role="alert">{errorGeneral}</p>}
                                <button className="btn login-submit" type="submit" disabled={revisando}>{revisando ? 'Calculando total…' : <>Revisar mi pedido&nbsp; →</>}</button>
                            </form>
                        )}
                    </aside>
                </div>
            </div>
        </main>
    );
}
