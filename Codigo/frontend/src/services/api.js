// Todas las llamadas pasan por el API Gateway: /api/<servicio>/<ruta>
const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'cfToken';

export function getToken() {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setToken(token) {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch {
        // El navegador bloqueó el almacenamiento.
    }
}

async function request(path, { method = 'GET', body, form } = {}) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';

    let response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            method,
            headers,
            body: form || (body ? JSON.stringify(body) : undefined)
        });
    } catch {
        throw new Error('No pudimos conectar con el servidor.');
    }

    // Si no llega JSON (por ejemplo, una página HTML), el backend no está respondiendo bien.
    const data = await response.json().catch(() => null);
    if (data === null) throw new Error('El servidor no respondió. Revisa que el backend esté encendido.');
    if (!response.ok) throw new Error(data.error || 'Ocurrió un error inesperado.');
    return data;
}

export const api = {
    // Servicio de usuarios
    login: (correo, contrasena) => request('/usuarios/login', { method: 'POST', body: { correo, contrasena } }),
    registro: (datos) => request('/usuarios/registro', { method: 'POST', body: datos }),
    perfil: () => request('/usuarios/perfil'),

    // Servicio de catálogo
    productos: (filtros = {}) => {
        const params = new URLSearchParams(
            Object.entries(filtros).filter(([, value]) => value)
        );
        return request(`/catalogo/productos?${params}`);
    },
    producto: (id) => request(`/catalogo/productos/${id}`),
    categorias: () => request('/catalogo/categorias'),

    // Servicio de pedidos
    crearPedido: (pedido) => request('/pedidos/pedidos', { method: 'POST', body: pedido }),
    misPedidos: () => request('/pedidos/pedidos'),

    // Servicio de personalización (multipart para adjuntar la referencia)
    crearSolicitud: (formData) => request('/personalizacion/solicitudes', { method: 'POST', form: formData })
};
