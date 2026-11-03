import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
    const { pathname } = useLocation();

    // Con llaves: useEffect solo acepta que se devuelva una función de limpieza.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}
