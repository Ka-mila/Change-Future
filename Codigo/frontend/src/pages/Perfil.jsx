import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Campo from '../components/Campo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../services/api.js';
import { errorContrasena, errorRequerido, errorTelefono, formatearRut } from '../services/validaciones.js';

function sinVacios(errores) {
    return Object.fromEntries(Object.entries(errores).filter(([, mensaje]) => mensaje));
}

function formatearFecha(iso) {
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// HU01.4: el cliente consulta sus datos y puede cambiar nombre, apellido, teléfono y contraseña.
function DatosPersonales() {
    const { user, setUser } = useAuth();
    const showToast = useToast();
    const [editando, setEditando] = useState(false);
    const [datos, setDatos] = useState({});
    const [errores, setErrores] = useState({});
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
    const [sending, setSending] = useState(false);

    function empezar() {
        setDatos({ nombre: user.nombre, apellido: user.apellido || '', telefono: user.telefono || '' });
        setErrores({});
        setMensaje({ tipo: '', texto: '' });
        setEditando(true);
    }

    function cambiar(event) {
        setDatos({ ...datos, [event.target.name]: event.target.value });
        setErrores({ ...errores, [event.target.name]: '' });
    }

    async function guardar(event) {
        event.preventDefault();
        const encontrados = sinVacios({
            nombre: errorRequerido(datos.nombre, 'El nombre'),
            apellido: errorRequerido(datos.apellido, 'El apellido'),
            telefono: errorTelefono(datos.telefono)
        });
        setErrores(encontrados);
        if (Object.keys(encontrados).length) return;

        setSending(true);
        try {
            const respuesta = await api.actualizarPerfil(datos);
            setUser(respuesta.usuario);
            setEditando(false);
            setMensaje({ tipo: 'success', texto: respuesta.mensaje });
            showToast(respuesta.mensaje);
        } catch (e) {
            setErrores(e.campos || {});
            setMensaje({ tipo: 'error', texto: e.message });
        } finally {
            setSending(false);
        }
    }

    const campo = (id) => ({ id, value: datos[id] ?? '', onChange: cambiar, error: errores[id] });

    return (
        <section className="form-panel login-panel">
            <h2>Datos personales</h2>
            {!editando ? (
                <>
                    <div className="perfil-datos">
                        <div className="summary-row"><span>Nombre</span><b>{user.nombre}</b></div>
                        <div className="summary-row"><span>Apellido</span><b>{user.apellido || '—'}</b></div>
                        <div className="summary-row"><span>RUT</span><b>{user.rut ? formatearRut(user.rut) : '—'}</b></div>
                        <div className="summary-row"><span>Correo</span><b>{user.correo}</b></div>
                        <div className="summary-row"><span>Teléfono</span><b>{user.telefono || '—'}</b></div>
                        <div className="summary-row"><span>Cliente desde</span><b>{formatearFecha(user.fecha_registro)}</b></div>
                    </div>
                    {mensaje.texto && <p className={`notice ${mensaje.tipo}`}>{mensaje.texto}</p>}
                    <div className="perfil-actions">
                        <button className="btn" type="button" onClick={empezar}>Editar mis datos</button>
                    </div>
                </>
            ) : (
                <form onSubmit={guardar} noValidate>
                    <div className="form-row">
                        <Campo {...campo('nombre')} label="Nombre *" autoComplete="given-name" />
                        <Campo {...campo('apellido')} label="Apellido *" autoComplete="family-name" />
                    </div>
                    <Campo {...campo('telefono')} label="Teléfono" type="tel" autoComplete="tel" placeholder="+56 9 1234 5678" />
                    <p className="field-hint" style={{ marginTop: 12 }}>
                        El correo y el RUT identifican tu cuenta y no se pueden cambiar desde aquí.
                    </p>
                    {mensaje.tipo === 'error' && <p className="notice error" role="alert">{mensaje.texto}</p>}
                    <div className="perfil-actions">
                        <button className="btn" type="submit" disabled={sending}>{sending ? 'Guardando…' : 'Guardar cambios'}</button>
                        <button className="btn secondary" type="button" onClick={() => setEditando(false)}>Cancelar</button>
                    </div>
                </form>
            )}
        </section>
    );
}

function CambiarContrasena() {
    const vacio = { actual: '', nueva: '', confirmar: '' };
    const [datos, setDatos] = useState(vacio);
    const [errores, setErrores] = useState({});
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
    const [sending, setSending] = useState(false);

    function cambiar(event) {
        setDatos({ ...datos, [event.target.name]: event.target.value });
        setErrores({ ...errores, [event.target.name]: '' });
    }

    async function guardar(event) {
        event.preventDefault();
        const encontrados = sinVacios({
            actual: datos.actual ? '' : 'Ingresa tu contraseña actual',
            nueva: errorContrasena(datos.nueva),
            confirmar: datos.confirmar === datos.nueva ? '' : 'Las contraseñas no coinciden'
        });
        setErrores(encontrados);
        setMensaje({ tipo: '', texto: '' });
        if (Object.keys(encontrados).length) return;

        setSending(true);
        try {
            const respuesta = await api.cambiarContrasena(datos.actual, datos.nueva);
            setDatos(vacio);
            setMensaje({ tipo: 'success', texto: respuesta.mensaje });
        } catch (e) {
            setErrores(e.campos || {});
            setMensaje({ tipo: 'error', texto: e.message });
        } finally {
            setSending(false);
        }
    }

    const campo = (id) => ({ id, value: datos[id], onChange: cambiar, error: errores[id], type: 'password' });

    return (
        <section className="form-panel login-panel">
            <h2>Cambiar contraseña</h2>
            <form onSubmit={guardar} noValidate>
                <Campo {...campo('actual')} label="Contraseña actual" autoComplete="current-password" />
                <Campo {...campo('nueva')} label="Nueva contraseña" autoComplete="new-password" hint="Al menos 8 caracteres, con letras y números." />
                <Campo {...campo('confirmar')} label="Repite la nueva contraseña" autoComplete="new-password" />
                {mensaje.texto && <p className={`notice ${mensaje.tipo}`} role="status">{mensaje.texto}</p>}
                <div className="perfil-actions">
                    <button className="btn" type="submit" disabled={sending}>{sending ? 'Guardando…' : 'Actualizar contraseña'}</button>
                </div>
            </form>
        </section>
    );
}

export default function Perfil() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const showToast = useToast();
    const bienvenida = location.state?.mensaje;

    // HU01.3: cerrar sesión y volver a la vista de acceso
    function cerrarSesion() {
        logout();
        showToast('Cerraste tu sesión.');
        navigate('/login', { replace: true });
    }

    return (
        <main className="section">
            <div className="wrap">
                <div className="eyebrow">MI CUENTA</div>
                <div className="section-heading">
                    <h1>Hola, <span className="lime">{user.nombre}</span></h1>
                    <button className="btn secondary" type="button" onClick={cerrarSesion}>Cerrar sesión</button>
                </div>
                {bienvenida && <p className="notice success" role="status" style={{ marginBottom: 22 }}>{bienvenida}</p>}
                <div className="perfil-actions" style={{ margin: '0 0 22px' }}>
                    <Link className="btn secondary" to="/mis-pedidos">📦 Mis pedidos</Link>
                    {user.rol === 'administrador' && <Link className="btn secondary" to="/admin">Panel de administración</Link>}
                </div>
                <div className="perfil-grid">
                    <DatosPersonales />
                    <CambiarContrasena />
                </div>
            </div>
        </main>
    );
}
