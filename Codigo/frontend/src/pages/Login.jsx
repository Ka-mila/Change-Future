import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Campo from '../components/Campo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
    correoValido, errorContrasena, errorRequerido, errorTelefono, formatearRut, rutValido
} from '../services/validaciones.js';

const vacio = { nombre: '', apellido: '', rut: '', correo: '', telefono: '', contrasena: '', confirmar: '' };

// HU01.1: valida en el navegador antes de enviar; el servidor vuelve a validar todo.
function validarRegistro(datos) {
    const errores = {
        nombre: errorRequerido(datos.nombre, 'El nombre'),
        apellido: errorRequerido(datos.apellido, 'El apellido'),
        rut: !datos.rut.trim() ? 'El RUT es obligatorio' : rutValido(datos.rut) ? '' : 'El RUT no es válido',
        correo: !datos.correo.trim() ? 'El correo es obligatorio' : correoValido(datos.correo) ? '' : 'El correo no tiene un formato válido',
        telefono: errorTelefono(datos.telefono),
        contrasena: errorContrasena(datos.contrasena),
        confirmar: datos.confirmar === datos.contrasena ? '' : 'Las contraseñas no coinciden'
    };
    return Object.fromEntries(Object.entries(errores).filter(([, mensaje]) => mensaje));
}

function validarLogin(datos) {
    const errores = {
        correo: !datos.correo.trim() ? 'Ingresa tu correo' : correoValido(datos.correo) ? '' : 'El correo no tiene un formato válido',
        contrasena: datos.contrasena ? '' : 'Ingresa tu contraseña'
    };
    return Object.fromEntries(Object.entries(errores).filter(([, mensaje]) => mensaje));
}

export default function Login() {
    const { user, login, register, sessionError, recuperarSesion, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mode, setMode] = useState('login');
    const [datos, setDatos] = useState(vacio);
    const [errores, setErrores] = useState({});
    const [mensaje, setMensaje] = useState('');
    const [sending, setSending] = useState(false);
    const creatingAccount = mode === 'register';
    const solicitado = location.state?.desde;
    const destino = typeof solicitado === 'string' && solicitado.startsWith('/') && !solicitado.startsWith('//') && solicitado !== '/login' ? solicitado : '/perfil';

    if (user && !sending) return <Navigate to={destino} replace />;

    function changeMode(newMode) {
        setMode(newMode);
        setErrores({});
        setMensaje('');
    }

    function cambiar(event) {
        const { name, value } = event.target;
        setDatos((actual) => ({ ...actual, [name]: name === 'rut' ? formatearRut(value) : value }));
        setErrores((actual) => ({ ...actual, [name]: '' }));
    }

    async function submit(event) {
        event.preventDefault();
        const encontrados = creatingAccount ? validarRegistro(datos) : validarLogin(datos);
        setErrores(encontrados);
        setMensaje('');
        if (Object.keys(encontrados).length) return;

        setSending(true);
        try {
            if (creatingAccount) {
                const { confirmar, ...registro } = datos;
                const respuesta = await register(registro);
                navigate(destino, { replace: true, state: { mensaje: respuesta.mensaje } });
            } else {
                await login(datos.correo, datos.contrasena);
                navigate(destino, { replace: true });
            }
        } catch (e) {
            setErrores(e.campos || {});
            setMensaje(e.message);
            setSending(false);
        }
    }

    const campo = (id) => ({ id, value: datos[id], onChange: cambiar, error: errores[id] });

    return (
        <main className="section login-section">
            <div className="wrap">
                <section className="form-panel login-panel">
                    <div className="eyebrow">TU ESPACIO CHANGE FUTURE</div>
                    <h1>{creatingAccount ? <>Crea tu <span className="lime">cuenta</span></> : <>Ingresa a tu <span className="lime">cuenta</span></>}</h1>
                    <p className="form-hint">Continúa con tus ideas y tus compras.</p>
                    {sessionError && <div className="notice error" role="alert"><p>{sessionError}</p><button className="text-link" type="button" onClick={recuperarSesion} disabled={loading}>Revisar mi sesión otra vez</button></div>}

                    <div className="login-tabs">
                        <button className={`login-tab${!creatingAccount ? ' active' : ''}`} type="button" onClick={() => changeMode('login')}>Ingresar</button>
                        <button className={`login-tab${creatingAccount ? ' active' : ''}`} type="button" onClick={() => changeMode('register')}>Crear cuenta</button>
                    </div>

                    <form onSubmit={submit} noValidate>
                        {creatingAccount && (
                            <>
                                <div className="form-row">
                                    <Campo {...campo('nombre')} label="Nombre *" autoComplete="given-name" placeholder="Tu nombre" />
                                    <Campo {...campo('apellido')} label="Apellido *" autoComplete="family-name" placeholder="Tu apellido" />
                                </div>
                                <Campo {...campo('rut')} label="RUT *" inputMode="text" placeholder="12.345.678-9" />
                            </>
                        )}
                        <Campo {...campo('correo')} label={creatingAccount ? 'Correo electrónico *' : 'Correo electrónico'} type="email" autoComplete="email" placeholder="tucorreo@ejemplo.cl" />
                        {creatingAccount && (
                            <Campo {...campo('telefono')} label="Teléfono (opcional)" type="tel" autoComplete="tel" placeholder="+56 9 1234 5678" />
                        )}
                        <Campo
                            {...campo('contrasena')}
                            label={creatingAccount ? 'Contraseña *' : 'Contraseña'}
                            type="password"
                            autoComplete={creatingAccount ? 'new-password' : 'current-password'}
                            placeholder={creatingAccount ? 'Mínimo 8 caracteres' : 'Tu contraseña'}
                            hint={creatingAccount ? 'Al menos 8 caracteres, con letras y números.' : ''}
                        />
                        {creatingAccount && (
                            <Campo {...campo('confirmar')} label="Repite la contraseña *" type="password" autoComplete="new-password" placeholder="Repite tu contraseña" />
                        )}

                        {mensaje && <p className="notice error" role="alert">{mensaje}</p>}

                        <button className="btn login-submit" type="submit" disabled={sending}>
                            {sending ? 'Un momento…' : creatingAccount ? 'Crear cuenta' : 'Ingresar'}
                        </button>
                    </form>

                    {!creatingAccount && (
                        <div className="login-links">
                            <Link to="/recuperar">¿Olvidaste tu contraseña?</Link>
                            <button className="text-button" type="button" onClick={() => changeMode('register')}>Crear una cuenta</button>
                        </div>
                    )}
                    {creatingAccount && <p className="field-hint" style={{ marginTop: 14 }}>* Campos obligatorios</p>}
                </section>
            </div>
        </main>
    );
}
