import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    // Mientras se revisa el token guardado, las rutas privadas esperan en vez de redirigir.
    const [loading, setLoading] = useState(Boolean(getToken()));
    const [sessionError, setSessionError] = useState('');

    const recuperarSesion = useCallback(async () => {
        const tokenInicial = getToken();
        if (!tokenInicial) { setLoading(false); return; }
        setLoading(true);
        setSessionError('');
        try {
            const perfil = await api.perfil();
            if (getToken() === tokenInicial) setUser(perfil);
        } catch (e) {
            if (getToken() !== tokenInicial) return;
            if (e.status === 401) { setToken(null); setUser(null); }
            else setSessionError('No pudimos revisar tu sesión por ahora. Comprueba la conexión y vuelve a intentar.');
        } finally {
            if (getToken() === tokenInicial || !getToken()) setLoading(false);
        }
    }, []);
    useEffect(() => { recuperarSesion(); }, [recuperarSesion]);

    async function login(correo, contrasena) {
        const { token, usuario } = await api.login(correo, contrasena);
        setToken(token);
        setUser(usuario);
        setSessionError('');
        setLoading(false);
        return usuario;
    }

    async function register(datos) {
        const respuesta = await api.registro(datos);
        setToken(respuesta.token);
        setUser(respuesta.usuario);
        setSessionError('');
        setLoading(false);
        return respuesta;
    }

    // HU01.3: al cerrar sesión se borra el token, así ninguna llamada privada vuelve a funcionar.
    function logout() {
        setToken(null);
        setUser(null);
        setSessionError('');
        setLoading(false);
    }

    return (
        <AuthContext.Provider value={{ user, loading, sessionError, recuperarSesion, login, register, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
