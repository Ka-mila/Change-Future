import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Campo from '../components/Campo.jsx';
import { api } from '../services/api.js';
import { errorContrasena } from '../services/validaciones.js';

// HU01.5 (paso 2): se llega desde el enlace del correo (/restablecer?token=...).
export default function RestablecerContrasena() {
    const [params] = useSearchParams();
    const token = params.get('token') || '';
    const [datos, setDatos] = useState({ contrasena: '', confirmar: '' });
    const [errores, setErrores] = useState({});
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
    const [sending, setSending] = useState(false);
    const listo = mensaje.tipo === 'success';

    function cambiar(event) {
        setDatos({ ...datos, [event.target.name]: event.target.value });
        setErrores({ ...errores, [event.target.name]: '' });
    }

    async function submit(event) {
        event.preventDefault();
        const encontrados = Object.fromEntries(Object.entries({
            contrasena: errorContrasena(datos.contrasena),
            confirmar: datos.confirmar === datos.contrasena ? '' : 'Las contraseñas no coinciden'
        }).filter(([, texto]) => texto));
        setErrores(encontrados);
        if (Object.keys(encontrados).length) return;

        setSending(true);
        try {
            const respuesta = await api.restablecerContrasena(token, datos.contrasena);
            setMensaje({ tipo: 'success', texto: respuesta.mensaje });
        } catch (e) {
            setErrores(e.campos || {});
            setMensaje({ tipo: 'error', texto: e.message });
        } finally {
            setSending(false);
        }
    }

    return (
        <main className="section login-section">
            <div className="wrap">
                <section className="form-panel login-panel">
                    <div className="eyebrow">NUEVA CONTRASEÑA</div>
                    <h1>Crea tu nueva <span className="lime">contraseña</span></h1>

                    {!token ? (
                        <>
                            <p className="notice error">El enlace está incompleto. Ábrelo de nuevo desde el correo o solicita uno nuevo.</p>
                            <div className="login-links"><Link to="/recuperar">Solicitar un enlace nuevo</Link></div>
                        </>
                    ) : listo ? (
                        <>
                            <p className="notice success" role="status">{mensaje.texto}</p>
                            <Link className="btn login-submit" to="/login">Ir a ingresar</Link>
                        </>
                    ) : (
                        <form onSubmit={submit} noValidate>
                            <Campo
                                id="contrasena"
                                label="Nueva contraseña"
                                type="password"
                                autoComplete="new-password"
                                value={datos.contrasena}
                                error={errores.contrasena}
                                onChange={cambiar}
                                hint="Al menos 8 caracteres, con letras y números."
                            />
                            <Campo
                                id="confirmar"
                                label="Repite la nueva contraseña"
                                type="password"
                                autoComplete="new-password"
                                value={datos.confirmar}
                                error={errores.confirmar}
                                onChange={cambiar}
                            />
                            {mensaje.tipo === 'error' && (
                                <p className="notice error" role="alert">
                                    {mensaje.texto} <Link to="/recuperar">Solicitar otro enlace</Link>
                                </p>
                            )}
                            <button className="btn login-submit" type="submit" disabled={sending}>
                                {sending ? 'Guardando…' : 'Guardar contraseña'}
                            </button>
                        </form>
                    )}
                </section>
            </div>
        </main>
    );
}
