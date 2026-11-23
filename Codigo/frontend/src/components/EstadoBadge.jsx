import { ESTADOS } from '../services/pedidos.js';

// El estado siempre lleva icono y texto: el color nunca es la única pista.
export default function EstadoBadge({ estado }) {
    const info = ESTADOS[estado] || { nombre: estado, icono: '•' };
    return (
        <span className={`estado-badge estado-${estado}`}>
            <span aria-hidden="true">{info.icono}</span> {info.nombre}
        </span>
    );
}
