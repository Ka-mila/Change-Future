import { useRef, useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../services/api.js';

const PHOTO = 'https://images.unsplash.com/photo-1760894942780-2b4b82a42ac3?auto=format&fit=crop&w=1400&q=85';
const PHOTO_CREDIT = 'https://unsplash.com/photos/3d-printer-head-creating-object-with-purple-and-green-lights-NbJLUsYKUUI';

const kinds = [
    ['Figura o personaje', '♟ Figura o personaje', 'Mascotas, modelos, coleccionables'],
    ['Decoración', '◈ Decoración', 'Objetos para tus espacios'],
    ['Accesorio funcional', '⌘ Accesorio funcional', 'Soportes, repuestos, organizadores'],
    ['Regalo personalizado', '✦ Regalo personalizado', 'Nombres, fechas y recuerdos'],
    ['Algo diferente', '＋ Algo diferente', 'Cuéntanos qué imaginas']
];

const finishes = [
    ['Oscuro', '● Oscuro', 'Negro, grafito, morado'],
    ['Claro', '◐ Claro', 'Blanco, crema, gris'],
    ['Colorido', '✺ Colorido', 'Un tono que destaque'],
    ['Por conversar', '? Lo conversamos', 'Te recomendamos opciones']
];

const initialState = {
    tipo: '',
    descripcion: '',
    tamano: 'Aún no lo sé',
    cantidad: '1 unidad',
    acabado: 'Por conversar'
};

const steps = ['Tu idea', 'Detalles', 'Contacto'];

function ChoiceGrid({ options, value, onChange }) {
    return (
        <div className="choice-grid">
            {options.map(([key, title, hint]) => (
                <button
                    key={key}
                    type="button"
                    className={`choice${value === key ? ' selected' : ''}`}
                    onClick={() => onChange(key)}
                ><b>{title}</b><small>{hint}</small></button>
            ))}
        </div>
    );
}

export default function CreaDesdeCero() {
    const [step, setStep] = useState(0);
    const [idea, setIdea] = useState(initialState);
    const [file, setFile] = useState(null);
    const [sending, setSending] = useState(false);
    const formRef = useRef(null);
    const showToast = useToast();

    const update = (field) => (value) => setIdea((current) => ({ ...current, [field]: value }));

    function goTo(next) {
        if (step === 0 && next > 0 && !idea.tipo) {
            showToast('Elige una categoría para continuar.');
            return;
        }
        setStep(next);
        document.getElementById('solicitud')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function submit(event) {
        event.preventDefault();
        const contact = new FormData(event.currentTarget);
        const data = new FormData();
        Object.entries(idea).forEach(([key, value]) => data.append(key, value));
        ['nombre', 'correo', 'telefono', 'ciudad'].forEach((key) => data.append(key, contact.get(key) || ''));
        if (file) data.append('referencia', file);

        setSending(true);
        try {
            await api.crearSolicitud(data);
            setStep(3);
        } catch (e) {
            showToast(e.message);
        } finally {
            setSending(false);
        }
    }

    function restart() {
        formRef.current?.reset();
        setIdea(initialState);
        setFile(null);
        setStep(0);
    }

    const shortIdea = idea.descripcion.length > 52 ? `${idea.descripcion.slice(0, 52)}…` : idea.descripcion;

    return (
        <main>
            <section className="hero">
                <div className="wrap hero-grid">
                    <div>
                        <div className="eyebrow">TU IDEA, EN TUS MANOS</div>
                        <h1>Imagina.<br /><span className="lime">Lo creamos.</span></h1>
                        <p className="hero-copy">
                            ¿Tienes una idea que todavía no existe? Cuéntanos qué imaginas
                            y te ayudamos a convertirla en una pieza única, diseñada y fabricada en 3D.
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
                        <b>{index < 3 ? index + 1 : '✓'}</b>{label}
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
                        <p>Completa lo que ya sabes. Lo demás lo conversamos.</p>
                    </div>

                    <div className="wizard">
                        <form className="form-panel" ref={formRef} onSubmit={submit}>
                            <section className={`form-step${step === 0 ? ' active' : ''}`}>
                                <h2>¿Qué tienes en mente?</h2>
                                <p className="form-hint">Elige la categoría más cercana. Si no sabes, selecciona “Algo diferente”.</p>
                                <span className="form-label">Quiero crear...</span>
                                <ChoiceGrid options={kinds} value={idea.tipo} onChange={update('tipo')} />
                                <label className="form-label" htmlFor="idea-description">Describe tu idea</label>
                                <textarea
                                    className="field"
                                    id="idea-description"
                                    value={idea.descripcion}
                                    onChange={(e) => update('descripcion')(e.target.value)}
                                    placeholder="Ejemplo: quiero un soporte para mis audífonos con el nombre de mi equipo..."
                                />
                                <div className="wizard-footer">
                                    <span className="step-count">Paso 1 de 3</span>
                                    <button className="btn" type="button" onClick={() => goTo(1)}>Siguiente&nbsp; →</button>
                                </div>
                            </section>

                            <section className={`form-step${step === 1 ? ' active' : ''}`}>
                                <h2>Démosle forma</h2>
                                <p className="form-hint">Estas referencias nos ayudan a imaginar contigo. Puedes ajustar los detalles después.</p>
                                <div className="form-grid">
                                    <div>
                                        <label className="form-label" htmlFor="idea-size">Tamaño aproximado</label>
                                        <select className="field" id="idea-size" value={idea.tamano} onChange={(e) => update('tamano')(e.target.value)}>
                                            <option>Aún no lo sé</option>
                                            <option>Pequeño · hasta 10 cm</option>
                                            <option>Mediano · 10 a 20 cm</option>
                                            <option>Grande · más de 20 cm</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label" htmlFor="idea-quantity">¿Cuántas unidades?</label>
                                        <select className="field" id="idea-quantity" value={idea.cantidad} onChange={(e) => update('cantidad')(e.target.value)}>
                                            <option>1 unidad</option>
                                            <option>2 a 5 unidades</option>
                                            <option>6 o más unidades</option>
                                        </select>
                                    </div>
                                </div>
                                <span className="form-label">Color o acabado</span>
                                <ChoiceGrid options={finishes} value={idea.acabado} onChange={update('acabado')} />
                                <label className="form-label" htmlFor="idea-reference">Imagen de referencia <span className="muted">(opcional)</span></label>
                                <label className="upload" htmlFor="idea-reference">
                                    <strong>＋ Adjuntar una imagen</strong>
                                    JPG, PNG o PDF
                                    <input type="file" id="idea-reference" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0] || null)} />
                                </label>
                                <p className="muted" style={{ margin: '8px 0 0', fontSize: 10 }}>{file ? `Referencia: ${file.name}` : ''}</p>
                                <div className="wizard-footer">
                                    <button className="btn secondary" type="button" onClick={() => goTo(0)}>← Volver</button>
                                    <span className="step-count">Paso 2 de 3</span>
                                    <button className="btn" type="button" onClick={() => goTo(2)}>Siguiente&nbsp; →</button>
                                </div>
                            </section>

                            <section className={`form-step${step === 2 ? ' active' : ''}`}>
                                <h2>¿Cómo te contactamos?</h2>
                                <p className="form-hint">Un diseñador revisará tu idea y podrá conversar contigo para preparar una cotización.</p>
                                <div className="form-grid">
                                    <div>
                                        <label className="form-label" htmlFor="customer-name">Tu nombre</label>
                                        <input className="field" id="customer-name" name="nombre" required={step === 2} placeholder="Nombre y apellido" />
                                    </div>
                                    <div>
                                        <label className="form-label" htmlFor="customer-email">Correo electrónico</label>
                                        <input className="field" id="customer-email" name="correo" type="email" required={step === 2} placeholder="tucorreo@ejemplo.cl" />
                                    </div>
                                    <div>
                                        <label className="form-label" htmlFor="customer-phone">WhatsApp</label>
                                        <input className="field" id="customer-phone" name="telefono" type="tel" placeholder="+56 9 1234 5678" />
                                    </div>
                                    <div>
                                        <label className="form-label" htmlFor="customer-city">Comuna o ciudad</label>
                                        <input className="field" id="customer-city" name="ciudad" placeholder="Ej. Santiago, Ñuñoa" />
                                    </div>
                                </div>
                                <label className="muted" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 17, fontSize: 11 }}>
                                    <input type="checkbox" required={step === 2} style={{ accentColor: 'var(--lime)', marginTop: 1 }} />
                                    Acepto que Change Future me contacte para conversar sobre este proyecto.
                                </label>
                                <div className="wizard-footer">
                                    <button className="btn secondary" type="button" onClick={() => goTo(1)}>← Volver</button>
                                    <span className="step-count">Paso 3 de 3</span>
                                    <button className="btn" type="submit" disabled={sending}>
                                        {sending ? 'Enviando…' : <>Enviar mi idea&nbsp; →</>}
                                    </button>
                                </div>
                            </section>

                            <section className={`form-step${step === 3 ? ' active' : ''}`}>
                                <div className="empty-state">
                                    <div className="empty-icon">✓</div>
                                    <h2>¡Tu idea ya está en camino!</h2>
                                    <p>Recibimos tu solicitud. Un diseñador te contactará pronto.</p>
                                    <button className="btn secondary" type="button" onClick={restart}>Crear otra idea</button>
                                </div>
                            </section>
                        </form>

                        <aside className="preview-panel">
                            <h2 className="summary-title">Así va tomando forma</h2>
                            <div className="preview-art"><span>CF</span></div>
                            <div className="summary-row"><span>Proyecto</span><b>{idea.tipo || 'Por definir'}</b></div>
                            <div className="summary-row"><span>Descripción</span><b>{shortIdea || 'Cuéntanos tu idea'}</b></div>
                            <div className="summary-row"><span>Tamaño</span><b>{idea.tamano}</b></div>
                            <div className="summary-row"><span>Unidades</span><b>{idea.cantidad}</b></div>
                            <div className="summary-row"><span>Acabado</span><b>{idea.acabado}</b></div>
                            <p className="notice" style={{ marginTop: 15 }}>
                                Cada proyecto es único. El valor final depende del diseño, el tamaño y los materiales.
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
                        <article className="why-card"><i>✎</i><h3>Cuéntanos tu idea</h3><p>Con lo que tengas, partimos.</p></article>
                        <article className="why-card"><i>◌</i><h3>La diseñamos contigo</h3><p>Validamos medidas y detalles.</p></article>
                        <article className="why-card"><i>⌁</i><h3>La hacemos realidad</h3><p>Impresión 3D hecha en Chile.</p></article>
                    </div>
                </div>
            </section>
        </main>
    );
}
