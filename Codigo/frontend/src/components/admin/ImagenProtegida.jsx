import { useEffect, useState } from 'react';
import { urlImagenProtegida } from '../../services/api.js';

// Las imágenes de referencia solo las puede ver el administrador: se piden con su token.
export default function ImagenProtegida({ ruta, alt, className }) {
    const [url, setUrl] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!ruta) return undefined;
        let creada = '';
        let cancelado = false;
        urlImagenProtegida(ruta)
            .then((nueva) => {
                creada = nueva;
                if (!cancelado) setUrl(nueva);
            })
            .catch(() => !cancelado && setError(true));
        return () => {
            cancelado = true;
            if (creada) URL.revokeObjectURL(creada);
        };
    }, [ruta]);

    if (!ruta || error) return <div className={`${className || ''} imagen-vacia`}>Sin imagen</div>;
    if (!url) return <div className={`${className || ''} imagen-vacia`}>Cargando…</div>;
    return <img className={className} src={url} alt={alt} />;
}
