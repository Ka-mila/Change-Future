// Mismas reglas que el servicio de usuarios (backend/servicio-usuarios/validaciones.py).

export function limpiarRut(rut) {
    return (rut || '').replace(/[.\-\s]/g, '').toUpperCase();
}

export function rutValido(rut) {
    const limpio = limpiarRut(rut);
    if (!/^\d{7,8}[\dK]$/.test(limpio)) return false;

    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    let suma = 0;
    let factor = 2;
    for (const digito of [...cuerpo].reverse()) {
        suma += Number(digito) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const resto = 11 - (suma % 11);
    const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
    return dv === esperado;
}

// 123456785 -> 12.345.678-5 mientras la persona escribe
export function formatearRut(rut) {
    const limpio = limpiarRut(rut).replace(/[^\dK]/g, '').slice(0, 9);
    if (limpio.length < 2) return limpio;
    const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${cuerpo}-${limpio.slice(-1)}`;
}

export function correoValido(correo) {
    return /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(correo || '');
}

export function errorContrasena(contrasena) {
    if ((contrasena || '').length < 8) return 'Debe tener al menos 8 caracteres';
    if (!/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) return 'Debe tener al menos una letra y un número';
    return '';
}

export function errorTelefono(telefono) {
    if (telefono && !/^\+?[\d\s]{8,15}$/.test(telefono)) return 'Formato no válido (ej: +56 9 1234 5678)';
    return '';
}

export function errorRequerido(valor, etiqueta) {
    return (valor || '').trim() ? '' : `${etiqueta} es obligatorio`;
}
