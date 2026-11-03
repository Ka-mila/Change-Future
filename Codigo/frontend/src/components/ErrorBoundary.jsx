import { Component } from 'react';

// Si un componente falla, muestra el error en pantalla en vez de dejar la página en blanco.
export default class ErrorBoundary extends Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <main className="section">
                <div className="wrap empty-state">
                    <div className="empty-icon">!</div>
                    <h1>Algo salió mal</h1>
                    <p>Copia este mensaje para revisarlo:</p>
                    <pre className="notice" style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                        {String(this.state.error?.stack || this.state.error)}
                    </pre>
                    <button className="btn" type="button" onClick={() => window.location.reload()}>Recargar</button>
                </div>
            </main>
        );
    }
}
