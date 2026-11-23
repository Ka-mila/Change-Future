import { useEffect, useState } from 'react';
import { ETAPAS, nombreEstado, nombrePago } from '../services/pedidos.js';
import EscenaPedido from './EscenaPedido.jsx';
import '../styles/checkout.css';
import '../styles/seguimiento-3d.css';

function IconoEtapa({ etapa, esMetro }) {
    if (etapa === 'enviado' && esMetro) return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 15V5h14v10M5 18V9l7 6 7-6v9M5 18h14" strokeLinejoin="round" /></svg>;
    if (etapa === 'enviado') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 5h11v12H3zM14 9h4l3 4v4h-7M3 13h11" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>;
    if (etapa === 'en_produccion') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M8 5l9 5" /></svg>;
    if (etapa === 'entregado') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m4 12 5 5L20 6" /></svg>;
    if (etapa === 'confirmado') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM8 12l3 3 5-6" /></svg>;
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></svg>;
}

const TITULOS_ETAPA = { pendiente: 'Recibido', confirmado: 'Confirmado', en_produccion: 'En producción', enviado: 'En camino', entregado: 'Entregado' };

export function vistaDelPedido(pedido, descripcionEstado) {
    const metodoPago = pedido.pago?.metodo || pedido.metodo_pago;
    const estadoPago = pedido.pago?.estado || pedido.estado_pago;
    const transferencia = metodoPago === 'transferencia';
    const esMetro = pedido.metodo_entrega === 'metro';
    if (pedido.estado === 'pendiente') {
        if (transferencia && estadoPago === 'en_revision') return {
            titulo: 'Tu comprobante está', acento: 'en revisión.', detalle: 'Ya recibimos tu comprobante. Estamos revisándolo para confirmar tu pedido.', nota: 'Revisión de pago'
        };
        if (transferencia && estadoPago === 'rechazado') return {
            titulo: 'Revisemos un detalle', acento: 'de tu pago.', detalle: 'Tu comprobante necesita una corrección. Revisa la observación y adjunta uno nuevo para continuar.', nota: 'Requiere tu revisión'
        };
        if (transferencia && estadoPago === 'aprobado') return {
            titulo: 'Tu pago ya está', acento: 'verificado.', detalle: 'Recibimos el pago. El equipo está preparando la confirmación de tu pedido.', nota: 'Preparando la confirmación'
        };
        return {
            titulo: 'Tu idea empieza', acento: 'aquí.',
            detalle: transferencia ? 'Recibimos tu pedido. Completa la transferencia y adjunta el comprobante para continuar.' : 'Recibimos tu pedido. Coordinaremos el pago y los detalles contigo.',
            nota: 'Pedido recibido'
        };
    }
    if (pedido.estado === 'confirmado') return {
        titulo: 'Todo listo para', acento: 'crear lo tuyo.',
        detalle: transferencia && estadoPago === 'aprobado' ? 'Tu pago está verificado y tu pedido confirmado. El siguiente paso es preparar tus piezas.' : 'Tu pedido está confirmado. Estamos preparando los detalles para comenzar.',
        nota: 'Pedido confirmado'
    };
    if (pedido.estado === 'en_produccion') return {
        titulo: 'Tu idea está', acento: 'tomando forma.', detalle: 'Estamos creando tus piezas, capa a capa, y cuidando cada detalle antes de prepararlas para la entrega.', nota: 'En nuestro taller · Impresión 3D'
    };
    if (pedido.estado === 'enviado') return esMetro ? {
        titulo: 'Tu pedido está', acento: 'listo para entregártelo.', detalle: 'Coordinemos el lugar y la hora de nuestro encuentro por WhatsApp. ¡Ya falta menos para tenerlo en tus manos!', nota: 'Entrega en Metro'
    } : {
        titulo: 'Lo que imaginaste,', acento: 'ya va hacia ti.', detalle: 'Tu pedido fue despachado. Revisa el código de seguimiento cuando esté disponible para conocer los detalles del transporte.', nota: 'Despacho a domicilio'
    };
    if (pedido.estado === 'entregado') return {
        titulo: 'De nuestra impresora', acento: 'a tus manos.', detalle: 'Tu pedido ya fue entregado. Gracias por crear con Change Future y darle vida a una nueva idea.', nota: 'Una idea hecha realidad'
    };
    if (pedido.estado === 'cancelado') return {
        titulo: 'Este pedido quedó', acento: 'cancelado.', detalle: 'Si necesitas ayuda con el pedido o el pago, escríbenos por WhatsApp y lo revisamos contigo.', nota: 'Estamos para ayudarte'
    };
    return {
        titulo: 'Revisemos cómo va', acento: 'tu pedido.', detalle: descripcionEstado || 'No tenemos un estado disponible. Escríbenos y te ayudamos a revisarlo.', nota: 'Consulta con nuestro equipo'
    };
}

export default function SeguimientoPedido({ pedido, descripcionEstado }) {
    const [animacionPausada, setAnimacionPausada] = useState(false);
    const [movimientoManual, setMovimientoManual] = useState(false);
    const [prefiereReducir, setPrefiereReducir] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefiereReducir(preferencia.matches);
        const actualizarPreferencia = (evento) => {
            setPrefiereReducir(evento.matches);
            setMovimientoManual(false);
            setAnimacionPausada(false);
        };
        if (preferencia.addEventListener) {
            preferencia.addEventListener('change', actualizarPreferencia);
            return () => preferencia.removeEventListener('change', actualizarPreferencia);
        }
        preferencia.addListener(actualizarPreferencia);
        return () => preferencia.removeListener(actualizarPreferencia);
    }, []);
    const detenidoPorPreferencia = prefiereReducir && !movimientoManual;
    const movimientoDetenido = animacionPausada || detenidoPorPreferencia;
    const etiquetaMovimiento = detenidoPorPreferencia ? 'Activar animación' : animacionPausada ? 'Reanudar animación' : 'Pausar animación';
    const cambiarMovimiento = () => {
        if (movimientoDetenido) {
            setMovimientoManual(true);
            setAnimacionPausada(false);
        } else {
            setAnimacionPausada(true);
        }
    };
    const cancelado = pedido.estado === 'cancelado';
    const actual = ETAPAS.indexOf(pedido.estado);
    const conocido = actual >= 0;
    const progreso = actual < 0 ? 0 : actual * 100 / (ETAPAS.length - 1);
    const esMetro = pedido.metodo_entrega === 'metro';
    const vista = vistaDelPedido(pedido, descripcionEstado);
    const nombreActual = cancelado ? 'Cancelado' : !conocido ? 'Estado por confirmar' : pedido.estado === 'enviado' && esMetro ? 'Listo para entrega' : nombreEstado(pedido.estado);
    const tieneMovimiento = pedido.estado === 'en_produccion' || (pedido.estado === 'enviado' && !esMetro);
    const metodoPago = pedido.pago?.metodo || pedido.metodo_pago;
    return (
        <section className={`cf-tracking cf-tracking-workshop${cancelado ? ' cf-tracking-cancelado' : ''}`}
            data-estado={conocido || cancelado ? pedido.estado : 'desconocido'} data-animation-paused={movimientoDetenido} data-motion-enabled={movimientoManual}
            aria-label="Seguimiento de tu pedido">
            <div className="cf-workshop-top">
                <span className="cf-kicker">EL VIAJE DE TU IDEA</span>
                <span className={`cf-status-pill${cancelado || !conocido ? ' is-warning' : ''}`}>{nombreActual}</span>
            </div>
            <div className="cf-workshop-hero">
                <div className="cf-workshop-visual"><EscenaPedido estado={pedido.estado} esMetro={esMetro} movimientoManual={movimientoManual} /></div>
                <div className="cf-workshop-story" aria-live="polite" aria-atomic="true">
                    {conocido && <span className="cf-workshop-position">ETAPA <b>{String(actual + 1).padStart(2, '0')}</b><span>/ {String(ETAPAS.length).padStart(2, '0')}</span></span>}
                    <h2>{vista.titulo}<span>{vista.acento}</span></h2>
                    <p>{vista.detalle}</p>
                    <span className="cf-workshop-note"><span aria-hidden="true" />{vista.nota}</span>
                </div>
            </div>
            {tieneMovimiento && <div className="cf-workshop-animation-control">
                <button type="button" className="cf-workshop-pause" data-motion-active={!movimientoDetenido}
                    aria-label={etiquetaMovimiento} onClick={cambiarMovimiento}>
                    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">{movimientoDetenido ? <path d="m5 3 8 5-8 5z" /> : <path d="M4 3h3v10H4zM9 3h3v10H9z" />}</svg>
                    {etiquetaMovimiento}
                </button>
                {detenidoPorPreferencia && <span className="cf-workshop-motion-note">Tu dispositivo limita el movimiento. Puedes activarlo aquí.</span>}
            </div>}
            {conocido && (
                <div className="cf-workshop-timeline">
                    <div className="cf-tracking-line" role="progressbar" aria-label="Avance del pedido" aria-valuemin={0} aria-valuemax={4}
                        aria-valuenow={actual} aria-valuetext={`Etapa ${actual + 1} de ${ETAPAS.length}: ${nombreActual}`}>
                        <span style={{ width: `${progreso}%` }} />
                    </div>
                    <ol className="cf-tracking-steps">
                        {ETAPAS.map((etapa, indice) => (
                            <li key={etapa} className={`${indice < actual ? 'is-done' : ''} ${indice === actual ? 'is-current' : ''}`}
                                aria-current={indice === actual ? 'step' : undefined}>
                                <span className="cf-step-icon">{indice < actual ? <span aria-hidden="true">✓</span> : <IconoEtapa etapa={etapa} esMetro={esMetro} />}</span>
                                <b>{etapa === 'enviado' && esMetro ? 'Para entregar' : TITULOS_ETAPA[etapa]}</b>
                                <small>{indice < actual ? 'Etapa anterior' : indice === actual ? 'Estamos aquí' : 'Próximamente'}</small>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
            <div className="cf-tracking-bottom">
                <span className="cf-live-dot" aria-hidden="true" /><span>Actualizado por nuestro equipo.</span>
                {metodoPago === 'transferencia' && <span className="cf-payment-inline">{nombrePago(pedido.pago?.estado || pedido.estado_pago)}</span>}
            </div>
            {pedido.metodo_entrega === 'blue' && pedido.codigo_seguimiento && (
                <div className="cf-tracking-code"><span>Código de seguimiento Blue Express</span><b>{pedido.codigo_seguimiento}</b><small>Usa este código en el seguimiento de Blue Express. Las etapas de esta página las actualiza Change Future.</small></div>
            )}
        </section>
    );
}
