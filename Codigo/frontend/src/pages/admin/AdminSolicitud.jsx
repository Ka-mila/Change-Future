import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminNav from '../../components/admin/AdminNav.jsx';
import ImagenProtegida from '../../components/admin/ImagenProtegida.jsx';
import Visor3D from '../../components/Visor3D.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import { formatPrice } from '../../services/format.js';
import { formatearFecha } from '../../services/pedidos.js';
import { ESTADOS_SOLICITUD, SolicitudBadge } from '../../services/solicitudes.jsx';

const NO_ELEGIBLES = ['borrador', 'recibida'];

// HU06.5: revisar la imagen, la propuesta 3D y las características, ver el cliente y cambiar el estado
export default function AdminSolicitud() {
    const { codigo } = useParams();
    const showToast = useToast();
    const [solicitud, setSolicitud] = useState(null);
    const [cliente, setCliente] = useState(null);
    const [pedidos, setPedidos] = useState([]);
    const [nuevoEstado, setNuevoEstado] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.solicitud(codigo)
            .then((s) => {
                setSolicitud(s);
                setObservaciones(s.observaciones || '');
                if (s.id_usuario) api.cliente(s.id_usuario).then(setCliente).catch(() => {});
            })
            .catch((e) => setError(e.message));
        api.pedidosPorSolicitud(codigo).then(setPedidos).catch(() => {});
    }, [codigo]);

    async function guardar(event) {
        event.preventDefault();
        setGuardando(true);
        setError('');
        try {
            const actualizada = await api.cambiarEstadoSolicitud(codigo, nuevoEstado || solicitud.estado, observaciones);
            setSolicitud(actualizada);
            setNuevoEstado('');
            showToast(`Solicitud actualizada: ${ESTADOS_SOLICITUD[actualizada.estado].nombre}.`);
        } catch (e) {
            setError(e.message);
        } finally {
            setGuardando(false);
        }
    }

    const propuesta = solicitud?.propuesta;
    const lado = solicitud?.tamano?.medida_mm || 100;

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">ADMINISTRACIÓN · SOLICITUDES</div>
                <div className="section-heading">
                    <h1>{solicitud ? solicitud.tipo : 'Solicitud'}</h1>
                    <AdminNav />
                </div>
                <p style={{ margin: '-12px 0 18px' }}><Link className="text-link" to="/admin/solicitudes">← Volver a solicitudes</Link></p>
                {error && !solicitud && <p className="notice error">{error}</p>}

                {solicitud && (
                    <div className="pedido-layout">
                        <section className="cart-list">
                            <div className="pedido-estado">
                                <div>
                                    <span className="muted" style={{ fontSize: 12 }}>Estado actual</span>
                                    <div style={{ marginTop: 6 }}><SolicitudBadge estado={solicitud.estado} /></div>
                                </div>
                                <span className="muted" style={{ fontSize: 12 }}>Código {codigo.slice(0, 8)} · {formatearFecha(solicitud.fecha, true)}</span>
                            </div>

                            <div className="solicitud-medios">
                                <figure>
                                    <ImagenProtegida className="solicitud-referencia" alt="Imagen de referencia enviada por el cliente"
                                        ruta={solicitud.imagen_referencia && `/personalizacion/referencias/${solicitud.imagen_referencia}`} />
                                    <figcaption>Imagen de referencia</figcaption>
                                </figure>
                                <figure>
                                    {propuesta
                                        ? <Visor3D url={api.modeloUrl(codigo, propuesta.id)} color={solicitud.color?.hex} medidaMm={lado}
                                            suave={propuesta.estilo === 'relieve'} />
                                        : <div className="solicitud-referencia imagen-vacia">Sin propuesta 3D</div>}
                                    <figcaption>Propuesta 3D</figcaption>
                                </figure>
                            </div>

                            <h2 className="summary-title" style={{ marginTop: 22 }}>Características solicitadas</h2>
                            <div className="summary-row"><span>Proyecto</span><b>{solicitud.tipo}</b></div>
                            {solicitud.descripcion && <div className="summary-row"><span>Descripción</span><b>{solicitud.descripcion}</b></div>}
                            <div className="summary-row"><span>Estilo</span><b>{propuesta?.estilo ? propuesta.estilo[0].toUpperCase() + propuesta.estilo.slice(1) : '—'}</b></div>
                            <div className="summary-row">
                                <span>Color</span>
                                <b>{solicitud.color ? <><span className="color-swatch" style={{ background: solicitud.color.hex, width: 14, height: 14, verticalAlign: 'middle', marginRight: 6 }} />{solicitud.color.nombre}</> : '—'}</b>
                            </div>
                            <div className="summary-row"><span>Tamaño</span><b>{solicitud.tamano ? `${solicitud.tamano.nombre} (${solicitud.tamano.medida_mm / 10} cm)` : '—'}</b></div>
                            {propuesta && (
                                <div className="summary-row">
                                    <span>Medidas de impresión</span>
                                    <b>{(propuesta.ancho_mm * lado / 100).toFixed(0)} × {(propuesta.alto_mm * lado / 100).toFixed(0)} × {propuesta.profundidad_mm} mm</b>
                                </div>
                            )}
                            <div className="summary-row total"><span>Precio referencial</span><b>{solicitud.precio ? formatPrice(solicitud.precio) : '—'}</b></div>
                            {propuesta && (
                                <a className="btn secondary small" style={{ marginTop: 14 }} href={api.modeloUrl(codigo, propuesta.id) + '&descargar=1&t=' + lado}
                                   download={`change-future-${codigo.slice(0, 8)}-${lado}mm.stl`}>
                                    ⬇ Descargar archivo para imprimir (STL)
                                </a>
                            )}
                        </section>

                        <aside className="cart-summary">
                            <h2 className="summary-title">Cliente</h2>
                            {cliente ? (
                                <>
                                    <div className="summary-row"><span>Nombre</span><b>{cliente.nombre} {cliente.apellido}</b></div>
                                    <div className="summary-row"><span>Correo</span><b>{cliente.correo}</b></div>
                                    <div className="summary-row"><span>Teléfono</span><b>{cliente.telefono || '—'}</b></div>
                                    <Link className="text-link" style={{ display: 'inline-block', marginTop: 10 }} to={`/admin/clientes/${cliente.id}`}>Ver ficha del cliente →</Link>
                                </>
                            ) : solicitud.contacto ? (
                                <>
                                    <div className="summary-row"><span>Nombre</span><b>{solicitud.contacto.nombre}</b></div>
                                    <div className="summary-row"><span>Correo</span><b>{solicitud.contacto.correo}</b></div>
                                    <div className="summary-row"><span>Teléfono</span><b>{solicitud.contacto.telefono || '—'}</b></div>
                                </>
                            ) : (
                                <p className="form-hint">El diseño se creó sin iniciar sesión. Se identifica al cliente por el pedido donde lo compró.</p>
                            )}

                            <h3 className="summary-subtitle">Pedidos con este diseño</h3>
                            {pedidos.length === 0 && <p className="form-hint">Todavía no se ha comprado.</p>}
                            {pedidos.map((p) => (
                                <p className="pedido-entrega" key={p.id}>
                                    <Link to={`/admin/pedidos/${p.id}`}>Pedido N° {p.id}</Link> · {p.cliente} · {formatearFecha(p.fecha)}
                                </p>
                            ))}

                            {solicitud.estado === 'borrador' ? (
                                <p className="notice" style={{ marginTop: 16 }}>El cliente todavía no confirma este diseño, por eso no se puede gestionar.</p>
                            ) : (
                                <form className="cambiar-estado" onSubmit={guardar}>
                                    <h3 className="summary-subtitle">Actualizar solicitud</h3>
                                    <label className="form-label" htmlFor="estado-solicitud">Nuevo estado</label>
                                    <select id="estado-solicitud" className="field" value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)}>
                                        <option value="">Mantener: {ESTADOS_SOLICITUD[solicitud.estado]?.nombre}</option>
                                        {Object.entries(ESTADOS_SOLICITUD)
                                            .filter(([clave]) => !NO_ELEGIBLES.includes(clave) && clave !== solicitud.estado)
                                            .map(([clave, info]) => <option key={clave} value={clave}>{info.nombre}</option>)}
                                    </select>
                                    <label className="form-label" htmlFor="observaciones">Observaciones del diseñador</label>
                                    <textarea id="observaciones" className="field" maxLength={1000} value={observaciones}
                                        onChange={(e) => setObservaciones(e.target.value)} placeholder="Ej.: aumentar el grosor de las orejas" />
                                    {error && <p className="notice error" role="alert">{error}</p>}
                                    <button className="btn login-submit" type="submit" disabled={guardando || (!nuevoEstado && observaciones === (solicitud.observaciones || ''))}>
                                        {guardando ? 'Guardando…' : 'Guardar'}
                                    </button>
                                </form>
                            )}
                        </aside>
                    </div>
                )}
            </div>
        </main>
    );
}
