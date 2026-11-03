import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);

    // Si hay un token guardado, recupera el perfil desde el servicio de usuarios.
    useEffect(() => {
        if (!getToken()) return;
        api.perfil()
            .then(setUser)
            .catch(() => setToken(null));
    }, []);

    async function login(correo, contrasena) {
        const { token, usuario } = await api.login(correo, contrasena);
        setToken(token);
        setUser(usuario);
        return usuario;
    }

    async function register(datos) {
        const { token, usuario } = await api.registro(datos);
        setToken(token);
        setUser(usuario);
        return usuario;
    }

    function logout() {
        setToken(null);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
