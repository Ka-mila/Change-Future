// Estados de las solicitudes de "Crea desde cero" (los define el servicio de personalización).
export const ESTADOS_SOLICITUD = {
    borrador: { nombre: 'Borrador', icono: '✎', clase: '' },
    confirmada: { nombre: 'Por revisar', icono: '◷', clase: 'estado-pendiente' },
    en_revision: { nombre: 'En revisión', icono: '◉', clase: '' },
    aprobada: { nombre: 'Aprobada', icono: '✓', clase: 'estado-entregado' },
    en_produccion: { nombre: 'En producción', icono: '⚙', clase: '' },
    completada: { nombre: 'Completada', icono: '★', clase: 'estado-entregado' },
    rechazada: { nombre: 'Rechazada', icono: '✕', clase: 'estado-cancelado' },
    recibida: { nombre: 'Recibida (formulario anterior)', icono: '•', clase: '' }
};

export const FILTROS_SOLICITUD = ['', 'confirmada', 'en_revision', 'aprobada', 'en_produccion', 'completada', 'rechazada', 'borrador'];

export function SolicitudBadge({ estado }) {
    const info = ESTADOS_SOLICITUD[estado] || { nombre: estado, icono: '•', clase: '' };
    return (
        <span className={`estado-badge ${info.clase}`}>
            <span aria-hidden="true">{info.icono}</span> {info.nombre}
        </span>
    );
}
