import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
    const [message, setMessage] = useState('');
    const [visible, setVisible] = useState(false);
    const timer = useRef();

    const showToast = useCallback((text) => {
        setMessage(text);
        setVisible(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setVisible(false), 2600);
    }, []);

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            <div className={`toast${visible ? ' show' : ''}`}>{message}</div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
