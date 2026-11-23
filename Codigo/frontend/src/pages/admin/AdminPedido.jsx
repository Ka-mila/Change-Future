import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminNav from '../../components/admin/AdminNav.jsx';
import PedidoDetalle from '../../components/PedidoDetalle.jsx';
import { ComprobantePrivado } from '../../components/PagoTransferencia.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import { nombreEstado, nombrePago } from '../../services/pedidos.js';
import { usePedido } from '../../services/usePedido.js';

function RevisionTransferencia({ pedido, onActualizado }) {
    const pago = pedido.pago;
    const [observacion, setObservacion] = useState('');
    const [verificado, setVerificado] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const bloqueo = useRef(false);
    const showToast = useToast();
    if (!pago || pago.metodo !== 'transferencia') return null;
    const comprobantes = pago.comprobantes || [];

    async function revisar(estado) {
        if (bloqueo.current || pago.estado !== 'en_revision') return;
        if (estado === 'aprobado' && !verificado) { setError('Primero verifica el abono en tu cuenta bancaria.'); return; }
        if (estado === 'rechazado' && !observacion.trim()) { setError('Explica al cliente qué debe corregir.'); return; }
        bloqueo.current = true;
        setEnviando(true);
        setError('');
        try {
            onActualizado(await api.revisarPago(pedido.id, estado, observacion.trim()));
            setObservacion('');
            setVerificado(false);
            showToast(estado === 'aprobado' ? 'Pago verificado y pedido confirmado.' : 'Comprobante observado. El cliente puede enviar uno nuevo.');
        } catch (e) { setError(e.message); }
        finally { bloqueo.current = false; setEnviando(false); }
    }
    return <section className="cf-payment-card cf-admin-payment">
        <div className="cf-section-top"><div><span className="cf-kicker">REVISIÓN DEL PAGO</span><h2>Transferencia del cliente</h2></div><span className={`cf-status-pill cf-payment-${pago.estado}`}>{nombrePago(pago.estado)}</span></div>
        {pago.observacion && <p className="notice"><b>Última observación:</b> {pago.observacion}</p>}
        {comprobantes.length === 0 ? <p className="form-hint">El cliente todavía no adjunta un comprobante. Puedes contactar con él desde sus datos del pedido.</p>
            : <div className="cf-receipts-admin">{[...comprobantes].reverse().map((c) => <ComprobantePrivado key={c.id} comprobante={c} />)}</div>}
        {pago.estado === 'en_revision' && pedido.estado !== 'cancelado' && <div className="cf-payment-review">
            <p className="form-hint">Comprueba el monto y la referencia en tu cuenta bancaria. La imagen por sí sola no confirma un abono.</p>
            <label className="form-label" htmlFor="observacion-pago">Mensaje para el cliente</label>
            <textarea className="field" id="observacion-pago" maxLength={500} value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Obligatorio si necesitas que corrija el comprobante" disabled={enviando} />
            <label className="cf-accept-total"><input type="checkbox" checked={verificado} onChange={(e) => setVerificado(e.target.checked)} disabled={enviando} /><span>Verifiqué que la transferencia fue abonada por el monto del pedido.</span></label>
            {error && <p className="notice error" role="alert">{error}</p>}
            <div className="cf-action-row"><button type="button" className="btn" disabled={enviando || !verificado} onClick={() => revisar('aprobado')}>{enviando ? 'Guardando…' : 'Aprobar pago'}</button><button type="button" className="btn secondary" disabled={enviando || !observacion.trim()} onClick={() => revisar('rechazado')}>Solicitar corrección</button></div>
        </div>}
    </section>;
}

// HU05.4: el administrador cambia el estado; el cliente lo ve en su cuenta
export default function AdminPedido() {
    const { id } = useParams();
    const showToast = useToast();
    const { pedido, error: errorActualizacion, actualizado, actualizarPedido } = usePedido(id);
    const [estados, setEstados] = useState([]);
    const [nuevoEstado, setNuevoEstado] = useState('');
    const [comentario, setComentario] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [codigoSeguimiento, setCodigoSeguimiento] = useState('');

    useEffect(() => {
        api.estadosPedido().then(setEstados).catch(() => {});
    }, [id]);
    useEffect(() => { setCodigoSeguimiento(pedido?.codigo_seguimiento || ''); }, [id, pedido?.codigo_seguimiento]);

    async function guardar(event) {
        event.preventDefault();
        setGuardando(true);
        setError('');
        try {
            const actualizado = await api.cambiarEstadoPedido(id, nuevoEstado || pedido.estado, comentario,
                pedido.metodo_entrega === 'blue' ? codigoSeguimiento.trim() : undefined);
            actualizarPedido(actualizado);
            setNuevoEstado('');
            setComentario('');
            showToast(`Pedido N° ${id}: ahora está ${nombreEstado(actualizado.estado).toLowerCase()}.`);
        } catch (e) {
            setError(e.message);
        } finally {
            setGuardando(false);
        }
    }

    const descripcion = estados.find((e) => e.id === pedido?.estado)?.descripcion;
    const pagoPendiente = pedido?.pago?.metodo === 'transferencia' && pedido.pago.estado !== 'aprobado';

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">ADMINISTRACIÓN</div>
                <div className="section-heading">
                    <h1>Pedido <span className="lime">N° {id}</span></h1>
                    <AdminNav />
                </div>
                <p style={{ margin: '-12px 0 18px' }}><Link className="text-link" to="/admin/pedidos">← Volver a pedidos recibidos</Link></p>
                {errorActualizacion && <p className="notice error" role="alert">{pedido ? 'La actualización automática no está disponible por ahora. ' : ''}{errorActualizacion}</p>}
                {!pedido && !errorActualizacion && <p className="muted">Cargando pedido…</p>}
                {actualizado && <p className="cf-refresh-note"><span className="cf-live-dot" aria-hidden="true" /> Actualización automática cada 18 segundos · Última revisión {actualizado.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</p>}
                {pedido && (
                    <PedidoDetalle pedido={pedido} descripcionEstado={descripcion} contenidoPrincipal={<RevisionTransferencia key={pedido.id} pedido={pedido} onActualizado={actualizarPedido} />}>
                        {pedido.id_usuario && (
                            <Link className="text-link" style={{ display: 'inline-block', margin: '12px 0 4px' }}
                                to={`/admin/clientes/${pedido.id_usuario}`}>Ver ficha del cliente →</Link>
                        )}
                        <form className="cambiar-estado" onSubmit={guardar}>
                            <h3 className="summary-subtitle">Actualizar estado</h3>
                            {pagoPendiente && <p className="notice">Primero revisa y aprueba la transferencia. La producción y el despacho se habilitan después de verificar el pago.</p>}
                            <label className="form-label" htmlFor="nuevo-estado">Nuevo estado</label>
                            <select id="nuevo-estado" className="field" value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} required>
                                <option value="">Elige un estado</option>
                                {estados.filter((e) => e.id !== pedido.estado).map((e) => (
                                    <option key={e.id} value={e.id} disabled={pagoPendiente && e.id !== 'cancelado' && e.id !== 'pendiente'}>{nombreEstado(e.id)}</option>
                                ))}
                            </select>
                            <label className="form-label" htmlFor="comentario">Comentario para el cliente (opcional)</label>
                            <input id="comentario" className="field" maxLength={300} value={comentario}
                                onChange={(e) => setComentario(e.target.value)} placeholder="Ej.: Despachado con código BX12345" />
                            {pedido.metodo_entrega === 'blue' && <><label className="form-label" htmlFor="codigo-seguimiento">Código de seguimiento Blue Express (opcional)</label><input id="codigo-seguimiento" className="field" maxLength={100} value={codigoSeguimiento} onChange={(e) => setCodigoSeguimiento(e.target.value)} placeholder="Código real entregado por Blue Express" /><small className="cf-private-note">Se mostrará al cliente. Registrar este código no crea un despacho en Blue Express.</small></>}
                            {error && <p className="notice error" role="alert">{error}</p>}
                            <button className="btn login-submit" type="submit" disabled={guardando || (!nuevoEstado && codigoSeguimiento.trim() === (pedido.codigo_seguimiento || ''))}>
                                {guardando ? 'Guardando…' : 'Guardar estado'}
                            </button>
                        </form>
                    </PedidoDetalle>
                )}
            </div>
        </main>
    );
}
