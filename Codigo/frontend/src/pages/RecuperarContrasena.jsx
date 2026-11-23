import { useState } from 'react';
import { Link } from 'react-router-dom';
import Campo from '../components/Campo.jsx';
import { api } from '../services/api.js';
import { correoValido } from '../services/validaciones.js';

// HU01.5 (paso 1): la persona ingresa su correo y recibe un enlace para crear una contraseña nueva.
export default function RecuperarContrasena() {
    const [correo, setCorreo] = useState('');
    const [error, setError] = useState('');
    const [enviado, setEnviado] = useState(null);
    const [sending, setSending] = useState(false);

    async function submit(event) {
        event.preventDefault();
        if (!correoValido(correo)) {
            setError('Ingresa un correo válido');
            return;
        }
        setSending(true);
        setError('');
        try {
            const respuesta = await api.recuperarContrasena(correo);
            setEnviado({ mensaje: respuesta.mensaje, configurado: respuesta.correo_configurado === true });
        } catch (e) {
            setError(e.campos?.correo || e.message);
        } finally {
            setSending(false);
        }
    }

    return (
        <main className="section login-section">
            <div className="wrap">
                <section className="form-panel login-panel">
                    <div className="eyebrow">RECUPERAR CONTRASEÑA</div>
                    <h1>¿Olvidaste tu <span className="lime">contraseña?</span></h1>

                    {enviado ? (
                        <>
                            <p className="notice" role="status">{enviado.mensaje}</p>
                            <p className="form-hint">
                                {enviado.configurado
                                    ? 'Si recibes el correo, abre el enlace para crear tu nueva contraseña. Revisa también la carpeta de spam.'
                                    : 'Puedes escribir a changefuture.store@gmail.com para solicitar ayuda con el acceso a tu cuenta.'}
                            </p>
                            <div className="login-links">
                                <Link to="/login">← Volver a ingresar</Link>
                                <button className="text-button" type="button" onClick={() => setEnviado(null)}>Volver al formulario</button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="form-hint">Escribe el correo de tu cuenta para solicitar un enlace de recuperación.</p>
                            <form onSubmit={submit} noValidate>
                                <Campo
                                    id="correo"
                                    label="Correo electrónico"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="tucorreo@ejemplo.cl"
                                    value={correo}
                                    error={error}
                                    onChange={(e) => { setCorreo(e.target.value); setError(''); }}
                                />
                                <button className="btn login-submit" type="submit" disabled={sending}>
                                    {sending ? 'Enviando…' : 'Enviar enlace'}
                                </button>
                            </form>
                            <div className="login-links">
                                <Link to="/login">← Volver a ingresar</Link>
                            </div>
                        </>
                    )}
                </section>
            </div>
        </main>
    );
}
