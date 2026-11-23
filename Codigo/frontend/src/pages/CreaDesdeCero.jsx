import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Visor3D from '../components/Visor3D.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../services/api.js';
import { formatPrice } from '../services/format.js';

const PHOTO = 'https://images.unsplash.com/photo-1760894942780-2b4b82a42ac3?auto=format&fit=crop&w=1400&q=85';
const PHOTO_CREDIT = 'https://unsplash.com/photos/3d-printer-head-creating-object-with-purple-and-green-lights-NbJLUsYKUUI';

const kinds = [
    ['Figura o personaje', '♟ Figura o personaje', 'Mascotas, modelos, coleccionables'],
    ['Decoración', '◈ Decoración', 'Objetos para tus espacios'],
    ['Accesorio funcional', '⌘ Accesorio funcional', 'Soportes, repuestos, organizadores'],
    ['Regalo personalizado', '✦ Regalo personalizado', 'Nombres, fechas y recuerdos'],
    ['Algo diferente', '＋ Algo diferente', 'Cuéntanos qué imaginas']
];

const estilos = {
    silueta: { titulo: '◆ Silueta', ejemplo: 'Llaveros, imanes, figuras recortadas' },
    relieve: { titulo: '▦ Relieve', ejemplo: 'Cuadros, placas, fotos en relieve' }
};

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const steps = ['Tu idea', 'Tu imagen', 'Color y tamaño', 'Confirmar'];

function ChoiceGrid({ options, value, onChange, className = '' }) {
    return (
        <div className={`choice-grid ${className}`}>
            {options.map(([key, title, hint, extra]) => (
                <button
                    key={key}
                    type="button"
                    className={`choice${value === key ? ' selected' : ''}`}
                    aria-pressed={value === key}
                    onClick={() => onChange(key)}
                >
                    <b>{title}</b><small>{hint}</small>{extra}
                </button>
            ))}
        </div>
    );
}

// Miniatura liviana para mostrar en el carrito (se guarda en el navegador)
function crearMiniatura(url) {
    return new Promise((resolve) => {
        const imagen = new Image();
        imagen.onload = () => {
            const lado = 160;
            const escala = lado / Math.max(imagen.width, imagen.height);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(imagen.width * escala);
            canvas.height = Math.round(imagen.height * escala);
            canvas.getContext('2d').drawImage(imagen, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        imagen.onerror = () => resolve('/assets/images/product-placeholder.svg');
        imagen.src = url;
    });
}

function formatearCm(mm) {
    return (mm / 10).toLocaleString('es-CL', { maximumFractionDigits: 1 });
}

export default function CreaDesdeCero() {
    const [step, setStep] = useState(0);
    const [idea, setIdea] = useState({ tipo: '', descripcion: '' });
    const [opciones, setOpciones] = useState(null);
    const [archivo, setArchivo] = useState(null);
    const [vistaPrevia, setVistaPrevia] = useState('');
    const [errorArchivo, setErrorArchivo] = useState('');
    const [estilo, setEstilo] = useState('silueta');
    const [solicitud, setSolicitud] = useState(null);
    // Si la generación falla, la imagen ya quedó guardada con este código y se puede reintentar
    const [codigoReintento, setCodigoReintento] = useState('');
    const [generando, setGenerando] = useState(false);
    const [errorGeneracion, setErrorGeneracion] = useState('');
    const [confirmando, setConfirmando] = useState(false);
    const showToast = useToast();
    const { addItem } = useCart();

    useEffect(() => {
        api.opcionesPersonalizacion()
            .then(setOpciones)
            .catch((e) => setErrorGeneracion(e.message));
    }, []);

    // Liberar la vista previa al cambiar de imagen
    useEffect(() => () => vistaPrevia && URL.revokeObjectURL(vistaPrevia), [vistaPrevia]);

    const maxMb = opciones?.max_mb ?? 10;
    const propuesta = solicitud?.propuesta;
    const color = solicitud?.color;
    const tamano = solicitud?.tamano;
    const tamanoVisor = tamano?.medida_mm ?? 100;

    function goTo(next) {
        if (next > 0 && !idea.tipo) {
            showToast('Elige qué quieres crear para continuar.');
            return;
        }
        if (next > 1 && !propuesta) {
            showToast('Primero genera tu propuesta 3D.');
            return;
        }
        if (next > 2 && (!color || !tamano)) {
            showToast('Elige un color y un tamaño para continuar.');
            return;
        }
        setStep(next);
        document.getElementById('solicitud')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Cargar imagen: solo formatos permitidos y hasta el peso máximo
    function elegirArchivo(event) {
        const elegido = event.target.files[0];
        event.target.value = '';
        if (!elegido) return;

        if (!TIPOS_IMAGEN.includes(elegido.type)) {
            setErrorArchivo('Formato no permitido. Usa una imagen JPG, PNG o WEBP.');
            return;
        }
        if (elegido.size > maxMb * 1024 * 1024) {
            setErrorArchivo(`La imagen pesa más de ${maxMb} MB. Usa una más liviana.`);
            return;
        }
        setErrorArchivo('');
        setErrorGeneracion('');
        setArchivo(elegido);
        setVistaPrevia(URL.createObjectURL(elegido));
        // Imagen nueva = solicitud nueva
        setSolicitud(null);
        setCodigoReintento('');
    }

    // Generar propuesta: envía la imagen al servicio de procesamiento
    async function generar() {
        if (!archivo) {
            setErrorArchivo('Selecciona una imagen de referencia.');
            return;
        }
        setGenerando(true);
        setErrorGeneracion('');
        try {
            const codigo = solicitud?.codigo || codigoReintento;
            let nueva;
            if (codigo) {
                nueva = await api.regenerarPropuesta(codigo, estilo);
            } else {
                const datos = new FormData();
                datos.append('tipo', idea.tipo);
                datos.append('descripcion', idea.descripcion);
                datos.append('estilo', estilo);
                datos.append('imagen', archivo);
                nueva = await api.crearSolicitud(datos);
            }
            // Conservar color y tamaño si ya estaban elegidos
            if (solicitud?.color || solicitud?.tamano) {
                nueva = await api.actualizarSolicitud(nueva.codigo, {
                    id_color: solicitud.color?.id ?? null,
                    id_tamano: solicitud.tamano?.id ?? null
                });
            }
            setSolicitud(nueva);
            setCodigoReintento('');
        } catch (e) {
            if (e.data?.codigo) setCodigoReintento(e.data.codigo);
            setErrorGeneracion(e.message);
        } finally {
            setGenerando(false);
        }
    }

    // Seleccionar color o tamaño: se guarda en la solicitud
    async function elegir(campo, id) {
        const lista = campo === 'id_color' ? opciones.colores : opciones.tamanos;
        const clave = campo === 'id_color' ? 'color' : 'tamano';
        const anterior = solicitud;
        setSolicitud({ ...solicitud, [clave]: lista.find((o) => o.id === id) });
        try {
            setSolicitud(await api.actualizarSolicitud(solicitud.codigo, { [campo]: id }));
        } catch (e) {
            setSolicitud(anterior);
            showToast(e.message);
        }
    }

    // Confirmar la configuración y agregarla al carrito
    async function confirmar() {
        setConfirmando(true);
        try {
            const confirmada = await api.confirmarSolicitud(solicitud.codigo);
            addItem({
                id: `diseno-${confirmada.codigo}`,
                nombre: confirmada.nombre_item,
                precio: confirmada.precio,
                imagen: await crearMiniatura(vistaPrevia),
                categoria: confirmada.detalle_item,
                codigo_solicitud: confirmada.codigo
            });
            setSolicitud(confirmada);
            setStep(4);
        } catch (e) {
            showToast(e.message);
        } finally {
            setConfirmando(false);
        }
    }

    function restart() {
        setIdea({ tipo: '', descripcion: '' });
        setArchivo(null);
        setVistaPrevia('');
        setErrorArchivo('');
        setErrorGeneracion('');
        setEstilo('silueta');
        setSolicitud(null);
        setCodigoReintento('');
        setStep(0);
    }

    const visor = propuesta && (
        <>
            <Visor3D
                url={api.modeloUrl(solicitud.codigo, propuesta.id)}
                color={color?.hex}
                medidaMm={tamanoVisor}
                suave={propuesta.estilo === 'relieve'}
            />
            <p className="medidas-3d">
                Medidas aproximadas{tamano ? '' : ' (tamaño mediano)'}:{' '}
                {formatearCm(propuesta.ancho_mm * tamanoVisor / 100)} × {formatearCm(propuesta.alto_mm * tamanoVisor / 100)} ×{' '}
                {formatearCm(propuesta.profundidad_mm)} cm · cada cuadro de la grilla mide 1 cm
            </p>
        </>
    );

    const estiloOpciones = (opciones?.estilos || []).map((e) => [e.id, estilos[e.id]?.titulo || e.id, e.descripcion,
        <small key="ejemplo" style={{ color: 'var(--quiet)' }}>{estilos[e.id]?.ejemplo}</small>]);
    const tamanoOpciones = (opciones?.tamanos || []).map((t) => [t.id, t.nombre, `${t.medida_mm / 10} cm de lado · ${t.descripcion}`,
        <span key="precio" className="precio-opcion">{formatPrice(t.precio)}</span>]);

    return (
        <main>
            <section className="hero">
                <div className="wrap hero-grid">
                    <div>
                        <div className="eyebrow">TU IDEA, EN TUS MANOS</div>
                        <h1>Imagina.<br /><span className="lime">Lo creamos.</span></h1>
                        <p className="hero-copy">
                            Sube una imagen de tu idea y mira al instante cómo se vería impresa en 3D.
                            Elige el color y el tamaño, y la fabricamos para ti.
                        </p>
                        <div className="hero-actions">
                            <a className="btn" href="#solicitud">Empezar mi proyecto&nbsp; →</a>
                            <a className="btn secondary" href="#proceso">Cómo funciona</a>
                        </div>
                        <p className="muted" style={{ marginTop: 15, fontSize: 11 }}>Sin compromiso · Te acompañamos en cada paso</p>
                    </div>
                    <div className="hero-art">
                        <img src={PHOTO} alt="Proceso de impresión 3D iluminado en tonos violeta y verde" />
                        <div className="art-label">IDEAS QUE<b>SE VUELVEN REALES</b></div>
                        <div className="photo-credit">
                            Foto: <a href={PHOTO_CREDIT} target="_blank" rel="noopener noreferrer">Jakub Żerdzicki / Unsplash</a>
                        </div>
                    </div>
                </div>
            </section>

            <div className="stepbar" aria-label="Pasos del formulario">
                {[...steps, 'Listo'].map((label, index) => (
                    <span key={label} className={step === index ? 'active' : ''}>
                        <b>{index < steps.length ? index + 1 : '✓'}</b>{label}
                    </span>
                ))}
            </div>

            <section className="section" id="solicitud">
                <div className="wrap">
                    <div className="section-heading">
                        <div>
                            <div className="eyebrow">DISEÑO A TU MEDIDA</div>
                            <h2>Empecemos <span className="lime">a crear</span></h2>
                        </div>
                        <p>Sube tu imagen y mira tu propuesta en 3D antes de pedirla.</p>
                    </div>

                    <div className="wizard">
                        <div className="form-panel">
                            {/* Paso 1: la idea */}
                            <section className={`form-step${step === 0 ? ' active' : ''}`}>
                                <h2>¿Qué tienes en mente?</h2>
                                <p className="form-hint">Elige la categoría más cercana. Si no sabes, selecciona “Algo diferente”.</p>
                                <span className="form-label">Quiero crear...</span>
                                <ChoiceGrid options={kinds} value={idea.tipo} onChange={(tipo) => setIdea({ ...idea, tipo })} />
                                <label className="form-label" htmlFor="idea-description">Describe tu idea <span className="muted">(opcional)</span></label>
                                <textarea
                                    className="field"
                                    id="idea-description"
                                    value={idea.descripcion}
                                    onChange={(e) => setIdea({ ...idea, descripcion: e.target.value })}
                                    placeholder="Ejemplo: un llavero con la silueta de mi perro y su nombre..."
                                />
                                <div className="wizard-footer">
                                    <span className="step-count">Paso 1 de 4</span>
                                    <button className="btn" type="button" onClick={() => goTo(1)}>Siguiente&nbsp; →</button>
                                </div>
                            </section>

                            {/* Paso 2: cargar imagen y generar propuesta */}
                            <section className={`form-step${step === 1 ? ' active' : ''}`}>
                                <h2>Sube tu imagen de referencia</h2>
                                <p className="form-hint">
                                    Funciona mejor con un dibujo, logo o foto con <b>fondo liso</b>. Con ella generamos una propuesta 3D.
                                </p>
                                <label className="upload" htmlFor="idea-reference">
                                    <strong>＋ {archivo ? 'Cambiar imagen' : 'Elegir una imagen'}</strong>
                                    JPG, PNG o WEBP · hasta {maxMb} MB
                                    <input type="file" id="idea-reference" accept={TIPOS_IMAGEN.join(',')} onChange={elegirArchivo} />
                                </label>
                                {errorArchivo && <p className="field-error" role="alert">{errorArchivo}</p>}
                                {archivo && (
                                    <div className="referencia-preview">
                                        <img src={vistaPrevia} alt="Tu imagen de referencia" />
                                        <span className="muted" style={{ fontSize: 11 }}>{archivo.name}</span>
                                    </div>
                                )}

                                <span className="form-label">Estilo de la pieza</span>
                                <ChoiceGrid className="dos" options={estiloOpciones} value={estilo} onChange={setEstilo} />

                                <div className="perfil-actions">
                                    <button className="btn" type="button" onClick={generar} disabled={generando || !opciones}>
                                        {generando ? 'Generando…' : propuesta ? 'Generar otra vez' : 'Generar propuesta 3D'}
                                    </button>
                                </div>

                                {generando && (
                                    <div className="cargando-propuesta notice" role="status">
                                        <span className="spinner" aria-hidden="true" />
                                        Estamos generando tu propuesta 3D. Esto toma unos segundos…
                                    </div>
                                )}
                                {errorGeneracion && !generando && (
                                    <p className="notice error" role="alert">
                                        {errorGeneracion}
                                    </p>
                                )}
                                {propuesta && !generando && <div style={{ marginTop: 18 }}>{visor}</div>}

                                <div className="wizard-footer">
                                    <button className="btn secondary" type="button" onClick={() => goTo(0)}>← Volver</button>
                                    <span className="step-count">Paso 2 de 4</span>
                                    <button className="btn" type="button" onClick={() => goTo(2)} disabled={!propuesta || generando}>Siguiente&nbsp; →</button>
                                </div>
                            </section>

                            {/* Paso 3: color y tamaño */}
                            <section className={`form-step${step === 2 ? ' active' : ''}`}>
                                <h2>Elige el color y el tamaño</h2>
                                <p className="form-hint">La vista 3D se actualiza con lo que elijas.</p>
                                {step === 2 && visor}

                                <span className="form-label">Color</span>
                                <div className="color-grid" role="radiogroup" aria-label="Color">
                                    {opciones?.colores.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={color?.id === c.id}
                                            className={`color-option${color?.id === c.id ? ' selected' : ''}`}
                                            onClick={() => elegir('id_color', c.id)}
                                        >
                                            <span className="color-swatch" style={{ background: c.hex }}>{color?.id === c.id ? '✓' : ''}</span>
                                            {c.nombre}
                                        </button>
                                    ))}
                                </div>

                                <span className="form-label">Tamaño</span>
                                <ChoiceGrid options={tamanoOpciones} value={tamano?.id} onChange={(id) => elegir('id_tamano', id)} />

                                <div className="wizard-footer">
                                    <button className="btn secondary" type="button" onClick={() => goTo(1)}>← Volver</button>
                                    <span className="step-count">Paso 3 de 4</span>
                                    <button className="btn" type="button" onClick={() => goTo(3)}>Siguiente&nbsp; →</button>
                                </div>
                            </section>

                            {/* Paso 4: revisar y confirmar */}
                            <section className={`form-step${step === 3 ? ' active' : ''}`}>
                                <h2>Revisa tu diseño</h2>
                                <p className="form-hint">Confirma que todo esté como lo quieres antes de agregarlo al carrito.</p>
                                {step === 3 && visor}
                                <div style={{ marginTop: 16 }}>
                                    <div className="summary-row"><span>Proyecto</span><b>{idea.tipo}</b></div>
                                    {idea.descripcion && <div className="summary-row"><span>Descripción</span><b>{idea.descripcion}</b></div>}
                                    <div className="summary-row"><span>Estilo</span><b>{propuesta && estilos[propuesta.estilo]?.titulo}</b></div>
                                    <div className="summary-row">
                                        <span>Color</span>
                                        <b>{color && <><span className="color-swatch" style={{ background: color.hex, width: 14, height: 14, verticalAlign: 'middle', marginRight: 6 }} />{color.nombre}</>}</b>
                                    </div>
                                    <div className="summary-row"><span>Tamaño</span><b>{tamano && `${tamano.nombre} (${tamano.medida_mm / 10} cm)`}</b></div>
                                    <div className="summary-row total"><span>Precio referencial</span><b>{tamano && formatPrice(tamano.precio)}</b></div>
                                </div>
                                <div className="wizard-footer">
                                    <button className="btn secondary" type="button" onClick={() => goTo(2)}>← Editar</button>
                                    <span className="step-count">Paso 4 de 4</span>
                                    <button className="btn" type="button" onClick={confirmar} disabled={confirmando}>
                                        {confirmando ? 'Agregando…' : <>Confirmar y agregar al carrito&nbsp; →</>}
                                    </button>
                                </div>
                            </section>

                            <section className={`form-step${step === 4 ? ' active' : ''}`}>
                                <div className="empty-state">
                                    <div className="empty-icon">✓</div>
                                    <h2>¡Tu diseño está en el carrito!</h2>
                                    <p>Cuando envíes el pedido, revisaremos la propuesta contigo por WhatsApp antes de imprimirla.</p>
                                    <div className="perfil-actions" style={{ justifyContent: 'center' }}>
                                        <Link className="btn" to="/carrito">Ir al carrito&nbsp; →</Link>
                                        <button className="btn secondary" type="button" onClick={restart}>Crear otra idea</button>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <aside className="preview-panel">
                            <h2 className="summary-title">Así va tomando forma</h2>
                            <div className="preview-art">
                                {vistaPrevia ? <img src={vistaPrevia} alt="Tu imagen de referencia" /> : <span>CF</span>}
                            </div>
                            <div className="summary-row"><span>Proyecto</span><b>{idea.tipo || 'Por definir'}</b></div>
                            <div className="summary-row"><span>Estilo</span><b>{propuesta ? estilos[propuesta.estilo]?.titulo : 'Por definir'}</b></div>
                            <div className="summary-row"><span>Color</span><b>{color?.nombre || 'Por elegir'}</b></div>
                            <div className="summary-row"><span>Tamaño</span><b>{tamano ? `${tamano.nombre} (${tamano.medida_mm / 10} cm)` : 'Por elegir'}</b></div>
                            <div className="summary-row"><span>Precio referencial</span><b>{tamano ? formatPrice(tamano.precio) : '—'}</b></div>
                            <p className="notice" style={{ marginTop: 15 }}>
                                La propuesta 3D es una primera versión. Antes de imprimir, un diseñador la revisa contigo
                                y te confirma el precio final.
                            </p>
                        </aside>
                    </div>
                </div>
            </section>

            <section className="section surface" id="proceso">
                <div className="wrap">
                    <div className="section-heading">
                        <div><div className="eyebrow">UN PROCESO CERCANO</div><h2>De la idea a <span className="lime">tus manos</span></h2></div>
                    </div>
                    <div className="why-grid">
                        <article className="why-card"><i>✎</i><h3>Sube tu imagen</h3><p>Un dibujo, un logo o una foto.</p></article>
                        <article className="why-card"><i>◌</i><h3>Mírala en 3D</h3><p>Elige color y tamaño al instante.</p></article>
                        <article className="why-card"><i>⌁</i><h3>La hacemos realidad</h3><p>Impresión 3D hecha en Chile.</p></article>
                    </div>
                </div>
            </section>
        </main>
    );
}
