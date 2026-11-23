import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Una actualización de fondo conserva el pedido visible y los formularios abiertos.
export function usePedido(id) {
    const [pedido, setPedido] = useState(null);
    const [error, setError] = useState('');
    const [actualizado, setActualizado] = useState(null);
    const version = useRef(0);
    const actualizarPedido = useCallback((nuevo) => {
        version.current += 1;
        setPedido(nuevo);
        setError('');
        setActualizado(new Date());
    }, []);

    useEffect(() => {
        let activo = true;
        let consultando = false;
        version.current += 1;
        setPedido(null);
        setError('');
        setActualizado(null);
        async function consultar() {
            if (consultando || document.visibilityState === 'hidden') return;
            consultando = true;
            const inicio = version.current;
            try {
                const nuevo = await api.pedido(id);
                if (activo && inicio === version.current) {
                    setPedido(nuevo);
                    setError('');
                    setActualizado(new Date());
                }
            } catch (e) {
                if (activo && inicio === version.current) setError(e.message);
            } finally {
                consultando = false;
            }
        }
        consultar();
        const temporizador = window.setInterval(consultar, 18000);
        document.addEventListener('visibilitychange', consultar);
        return () => {
            activo = false;
            window.clearInterval(temporizador);
            document.removeEventListener('visibilitychange', consultar);
        };
    }, [id]);
    return { pedido, error, actualizado, actualizarPedido };
}
