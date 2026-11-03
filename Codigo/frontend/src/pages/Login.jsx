import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
    const { user, login, register, logout } = useAuth();
    const [mode, setMode] = useState('login');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const creatingAccount = mode === 'register';

    function changeMode(newMode) {
        setMode(newMode);
        setMessage('');
    }

    async function submit(event) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        setSending(true);
        try {
            const usuario = creatingAccount
                ? await register({ nombre: data.name, correo: data.email, contrasena: data.password })
                : await login(data.email, data.password);
            setMessage(`¡Hola, ${usuario.nombre}! Sesión iniciada.`);
        } catch (e) {
            setMessage(e.message);
        } finally {
            setSending(false);
        }
    }

    return (
        <main className="section login-section">
            <div className="wrap">
                <section className="form-panel login-panel" style={{ maxWidth: 520, margin: '0 auto' }}>
                    <div className="eyebrow">TU ESPACIO CHANGE FUTURE</div>
                    <h1>Ingresa a tu <span className="lime">cuenta</span></h1>
                    <p className="form-hint">Continúa con tus ideas y tus compras.</p>

                    {user ? (
                        <>
                            <p className="form-hint">Sesión iniciada como <b>{user.correo}</b>.</p>
                            <button className="btn secondary" type="button" onClick={() => { logout(); setMessage('Sesión cerrada.'); }}>
                                Cerrar sesión
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="login-tabs">
                                <button className={`login-tab${!creatingAccount ? ' active' : ''}`} type="button" onClick={() => changeMode('login')}>Ingresar</button>
                                <button className={`login-tab${creatingAccount ? ' active' : ''}`} type="button" onClick={() => changeMode('register')}>Crear cuenta</button>
                            </div>
                            <form onSubmit={submit}>
                                {creatingAccount && (
                                    <>
                                        <label className="form-label" htmlFor="account-name">Nombre</label>
                                        <input className="field" id="account-name" name="name" autoComplete="name" placeholder="Tu nombre" required />
                                    </>
                                )}
                                <label className="form-label" htmlFor="account-email">Correo electrónico</label>
                                <input className="field" id="account-email" name="email" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.cl" required />
                                <label className="form-label" htmlFor="account-password">Contraseña</label>
                                <input
                                    className="field"
                                    id="account-password"
                                    name="password"
                                    type="password"
                                    autoComplete={creatingAccount ? 'new-password' : 'current-password'}
                                    placeholder="Mínimo 8 caracteres"
                                    minLength={8}
                                    required
                                />
                                <button className="btn login-submit" type="submit" disabled={sending}>
                                    {creatingAccount ? 'Crear cuenta' : 'Ingresar'}
                                </button>
                            </form>
                        </>
                    )}
                    <p className="form-hint" aria-live="polite">{message}</p>
                </section>
            </div>
        </main>
    );
}
