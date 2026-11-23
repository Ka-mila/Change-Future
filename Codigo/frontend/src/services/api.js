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
    if (!response.ok) {
        // campos: errores por campo ({ correo: 'Este correo ya está registrado' })
        const error = new Error(data.error || 'Ocurrió un error inesperado.');
        error.campos = data.campos || {};
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

// Archivos privados: la API verifica al propietario o administrador antes de servirlos.
export async function urlImagenProtegida(path) {
    const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!response.ok) throw new Error('No se pudo cargar la imagen.');
    return URL.createObjectURL(await response.blob());
}

export const api = {
    // Servicio de usuarios
    login: (correo, contrasena) => request('/usuarios/login', { method: 'POST', body: { correo, contrasena } }),
    registro: (datos) => request('/usuarios/registro', { method: 'POST', body: datos }),
    perfil: () => request('/usuarios/perfil'),
    actualizarPerfil: (datos) => request('/usuarios/perfil', { method: 'PUT', body: datos }),
    cambiarContrasena: (actual, nueva) => request('/usuarios/perfil/contrasena', { method: 'PUT', body: { actual, nueva } }),
    recuperarContrasena: (correo) => request('/usuarios/recuperar', { method: 'POST', body: { correo } }),
    restablecerContrasena: (token, contrasena) => request('/usuarios/restablecer', { method: 'POST', body: { token, contrasena } }),

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
    checkoutOpciones: () => request('/pedidos/checkout/opciones'),
    cotizarPedido: (pedido) => request('/pedidos/cotizar', { method: 'POST', body: pedido }),
    subirComprobante: (id, formData) => request(`/pedidos/pedidos/${id}/comprobante`, { method: 'POST', form: formData }),
    revisarPago: (id, estado, observacion) => request(`/pedidos/pedidos/${id}/pago`, { method: 'PATCH', body: { estado, observacion } }),
    misPedidos: () => request('/pedidos/pedidos'),
    pedido: (id) => request(`/pedidos/pedidos/${id}`),
    estadosPedido: () => request('/pedidos/estados'),
    // Administrador
    pedidosRecibidos: (filtros = {}) => {
        const params = new URLSearchParams({ todos: 'true', ...Object.fromEntries(Object.entries(filtros).filter(([, v]) => v)) });
        return request(`/pedidos/pedidos?${params}`);
    },
    cambiarEstadoPedido: (id, estado, comentario, codigo_seguimiento) => request(`/pedidos/pedidos/${id}/estado`, { method: 'PATCH', body: { estado, comentario, ...(codigo_seguimiento !== undefined ? { codigo_seguimiento } : {}) } }),
    estadisticas: (meses = 6) => request(`/pedidos/estadisticas?meses=${meses}`),
    pedidosPorSolicitud: (codigo) => request(`/pedidos/pedidos/por-solicitud/${codigo}`),
    productosAdmin: () => request('/catalogo/productos?incluir_inactivos=true'),
    productoAdmin: (id) => request(`/catalogo/productos/${id}`),
    crearProducto: (formData) => request('/catalogo/productos', { method: 'POST', form: formData }),
    modificarProducto: (id, formData) => request(`/catalogo/productos/${id}`, { method: 'PUT', form: formData }),
    cambiarEstadoProducto: (id, activo) => request(`/catalogo/productos/${id}/estado`, { method: 'PATCH', body: { activo } }),
    clientes: (q = '') => request(`/usuarios/clientes?${new URLSearchParams(q ? { q } : {})}`),
    cliente: (id) => request(`/usuarios/clientes/${id}`),
    solicitud: (codigo) => request(`/personalizacion/solicitudes/${codigo}`),
    solicitudesAdmin: (estado = '') => request(`/personalizacion/solicitudes?${new URLSearchParams(estado ? { estado } : {})}`),
    estadosSolicitud: () => request('/personalizacion/estados-solicitud'),
    cambiarEstadoSolicitud: (codigo, estado, observaciones) => request(`/personalizacion/solicitudes/${codigo}/estado`, { method: 'PATCH', body: { estado, observaciones } }),

    // Servicio de personalización ("Crea desde cero" y propuestas 3D)
    opcionesPersonalizacion: () => request('/personalizacion/opciones'),
    crearSolicitud: (formData) => request('/personalizacion/solicitudes', { method: 'POST', form: formData }),
    regenerarPropuesta: (codigo, estilo) => request(`/personalizacion/solicitudes/${codigo}/propuestas`, { method: 'POST', body: { estilo } }),
    actualizarSolicitud: (codigo, datos) => request(`/personalizacion/solicitudes/${codigo}`, { method: 'PATCH', body: datos }),
    confirmarSolicitud: (codigo) => request(`/personalizacion/solicitudes/${codigo}/confirmar`, { method: 'POST' }),
    // ?v= cambia con cada propuesta para que el navegador no muestre una versión vieja
    modeloUrl: (codigo, idPropuesta) => `${API_URL}/personalizacion/solicitudes/${codigo}/modelo?v=${idPropuesta}`
};
