import { useEffect, useRef, useState } from 'react';
import { api, urlImagenProtegida } from '../services/api.js';
import { formatPrice } from '../services/format.js';
import { formatearFecha, nombrePago } from '../services/pedidos.js';
import '../styles/checkout.css';

const FORMATOS = ['image/jpeg', 'image/png', 'image/webp'];

export function ComprobantePrivado({ comprobante }) {
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const [intento, setIntento] = useState(0);
    useEffect(() => {
        let activo = true;
        let creado;
        setUrl('');
        setError('');
        if (!comprobante.archivo_url) return undefined;
        urlImagenProtegida(comprobante.archivo_url).then((valor) => {
            creado = valor;
            if (activo) setUrl(valor);
            else URL.revokeObjectURL(valor);
        }).catch((e) => activo && setError(e.message));
        return () => { activo = false; if (creado) URL.revokeObjectURL(creado); };
    }, [comprobante.archivo_url, intento]);
    return (
        <article className="cf-receipt">
            {url ? <a className="cf-receipt-image" href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir comprobante completo en otra pestaña"><img src={url} alt="Comprobante de transferencia adjuntado" /></a>
                : <div className="cf-receipt-placeholder">{error || 'Cargando comprobante privado…'}{error && <button className="text-link" type="button" onClick={() => setIntento((i) => i + 1)}>Reintentar</button>}</div>}
            <div><b>{comprobante.nombre || 'Comprobante de transferencia'}</b><small>{formatearFecha(comprobante.fecha, true)}</small><small>{nombrePago(comprobante.estado)}</small>
                {url && <a className="text-link" href={url} target="_blank" rel="noopener noreferrer">Ver imagen completa ↗</a>}</div>
        </article>
    );
}

function DatoCopiable({ etiqueta, valor }) {
    const [mensaje, setMensaje] = useState('');
    async function copiar() {
        try { await navigator.clipboard.writeText(String(valor)); setMensaje('Copiado'); }
        catch { setMensaje('Selecciona el dato para copiarlo'); }
    }
    return <div className="cf-bank-row"><span>{etiqueta}</span><b>{valor || '—'}</b>{valor && <button type="button" className="cf-copy" onClick={copiar} aria-label={`Copiar ${etiqueta}`}>{mensaje || 'Copiar'}</button>}</div>;
}

export default function PagoTransferencia({ pedido, onActualizado }) {
    const pago = pedido.pago;
    const [archivo, setArchivo] = useState(null);
    const [preview, setPreview] = useState('');
    const [referencia, setReferencia] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [opciones, setOpciones] = useState(null);
    const bloqueo = useRef(false);
    useEffect(() => { api.checkoutOpciones().then(setOpciones).catch(() => {}); }, []);
    useEffect(() => {
        if (!archivo) { setPreview(''); return undefined; }
        const url = URL.createObjectURL(archivo);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [archivo]);
    if (!pago || pago.metodo !== 'transferencia') return null;
    const banco = pago.transferencia || opciones?.transferencia || {};
    const maxMb = opciones?.comprobante?.max_mb || 5;
    const formatos = opciones?.comprobante?.formatos || FORMATOS;
    const puedeAdjuntar = pedido.estado !== 'cancelado' && !['aprobado', 'en_revision'].includes(pago.estado);
    const ultimo = pago.comprobantes?.at(-1);

    function seleccionar(event) {
        const nuevo = event.target.files?.[0];
        event.target.value = '';
        if (!nuevo) return;
        setMensaje('');
        if (!formatos.includes(nuevo.type)) { setError('Elige una imagen JPG, PNG o WEBP.'); return; }
        if (nuevo.size > maxMb * 1024 * 1024) { setError(`La imagen debe pesar como máximo ${maxMb} MB.`); return; }
        setError('');
        setArchivo(nuevo);
    }

    async function subir(event) {
        event.preventDefault();
        if (bloqueo.current || !puedeAdjuntar) return;
        if (!archivo) { setError('Selecciona la imagen de tu comprobante.'); return; }
        bloqueo.current = true;
        setEnviando(true);
        setError('');
        try {
            const datos = new FormData();
            datos.append('archivo', archivo);
            datos.append('referencia_transferencia', referencia.trim());
            const actualizado = await api.subirComprobante(pedido.id, datos);
            onActualizado(actualizado);
            setArchivo(null);
            setReferencia('');
            setMensaje('Comprobante recibido. El equipo verificará la transferencia antes de aprobar el pago.');
        } catch (e) { setError(e.message); }
        finally { bloqueo.current = false; setEnviando(false); }
    }

    return (
        <section className="cf-payment-card" aria-label="Pago por transferencia">
            <div className="cf-section-top"><div><span className="cf-kicker">PAGO SEGURO, PASO A PASO</span><h2>Transferencia bancaria</h2></div><span className={`cf-status-pill cf-payment-${pago.estado}`}>{nombrePago(pago.estado)}</span></div>
            {pedido.estado === 'cancelado' ? <p className="notice">El pedido fue cancelado. Si ya transferiste, contáctanos para revisar tu caso.</p>
                : pago.estado === 'aprobado' ? <p className="cf-payment-success">✓ Verificamos tu transferencia. Puedes seguir la preparación de tu pedido arriba.</p>
                : pago.estado === 'en_revision' ? <p className="notice">Recibimos tu comprobante. El pago permanece en revisión hasta que el equipo confirme la transferencia.</p>
                : <p className="form-hint">Transfiere el total del pedido, indica su número y adjunta el comprobante. Recibir una imagen no significa que el pago esté aprobado.</p>}
            {pago.observacion && <p className={`notice${pago.estado === 'rechazado' ? ' error' : ''}`}><b>Mensaje del equipo:</b> {pago.observacion}</p>}
            {!['aprobado'].includes(pago.estado) && pedido.estado !== 'cancelado' && (
                <>
                    <div className="cf-transfer-amount"><span>Total a transferir</span><strong>{formatPrice(pedido.total)}</strong><span>Referencia: Pedido N° {pedido.id}</span></div>
                    {banco.configurada ? <div className="cf-bank-details"><DatoCopiable etiqueta="Titular" valor={banco.titular} /><DatoCopiable etiqueta="RUT" valor={banco.rut} /><DatoCopiable etiqueta="Banco" valor={banco.banco} /><DatoCopiable etiqueta="Tipo de cuenta" valor={banco.tipo_cuenta} /><DatoCopiable etiqueta="Número de cuenta" valor={banco.numero_cuenta} /><DatoCopiable etiqueta="Correo" valor={banco.correo} /></div>
                        : <p className="notice">Los datos bancarios aún no están disponibles en la página. Coordínalos con Change Future por WhatsApp antes de transferir. Tu pedido seguirá pendiente.</p>}
                </>
            )}
            {ultimo && <div className="cf-last-receipt"><h3>Último comprobante</h3><ComprobantePrivado comprobante={ultimo} /></div>}
            {puedeAdjuntar && (
                <form className="cf-upload-form" onSubmit={subir}>
                    <h3>{pago.estado === 'rechazado' ? 'Enviar un nuevo comprobante' : 'Adjunta tu comprobante'}</h3>
                    {!banco.configurada && <p className="form-hint">Si ya transferiste con los datos que coordinamos contigo, puedes adjuntar el comprobante aquí.</p>}
                    <label className="cf-receipt-picker"><b>＋ {archivo ? 'Cambiar imagen' : 'Elegir comprobante'}</b><span>JPG, PNG o WEBP · máximo {maxMb} MB</span><input type="file" accept={formatos.join(',')} onChange={seleccionar} disabled={enviando} /></label>
                    {preview && <div className="cf-upload-preview"><img src={preview} alt="Vista previa del comprobante que vas a enviar" /><span>{archivo?.name}</span><button className="text-link" type="button" onClick={() => setArchivo(null)} disabled={enviando}>Quitar</button></div>}
                    <label className="form-label" htmlFor="referencia-transferencia">Referencia de transferencia (opcional)</label><input id="referencia-transferencia" className="field" value={referencia} maxLength={100} onChange={(e) => setReferencia(e.target.value)} placeholder="Número de operación" disabled={enviando} />
                    {error && <p className="notice error" role="alert">{error}</p>}
                    <button className="btn" type="submit" disabled={!archivo || enviando}>{enviando ? 'Enviando comprobante…' : 'Enviar comprobante →'}</button>
                    <small className="cf-private-note">Tu comprobante es privado: lo pueden consultar tu cuenta y el equipo administrador.</small>
                </form>
            )}
            {mensaje && <p className="notice" role="status">{mensaje}</p>}
        </section>
    );
}
