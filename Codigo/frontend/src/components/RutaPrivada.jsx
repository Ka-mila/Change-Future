import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Envuelve páginas que requieren sesión: sin sesión, manda a /login y vuelve después.
// Con rol="administrador", además exige ese rol.
export default function RutaPrivada({ children, rol }) {
    const { user, loading, sessionError, recuperarSesion } = useAuth();
    const location = useLocation();

    if (loading) {
        return <main className="section"><div className="wrap"><p className="muted">Cargando…</p></div></main>;
    }
    if (!user) {
        if (sessionError) return <main className="section"><div className="wrap empty-state"><h1>Revisemos tu sesión</h1><p className="notice error" role="alert">{sessionError}</p><button className="btn" type="button" onClick={recuperarSesion}>Volver a intentar</button></div></main>;
        return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
    }
    if (rol && user.rol !== rol) {
        return (
            <main className="section">
                <div className="wrap empty-state">
                    <div className="empty-icon">!</div>
                    <h1>No tienes acceso</h1>
                    <p>Esta sección es solo para administradores.</p>
                </div>
            </main>
        );
    }
    return children;
}
