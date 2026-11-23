import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api se reenvía al API Gateway de Flask.
// Se usa 127.0.0.1 y no localhost porque en Windows localhost puede resolver a IPv6.
export default defineConfig({
    plugins: [react()],
    // La página "Crea desde cero" incluye la librería 3D (three.js), que pesa ~500 kB.
    build: { chunkSizeWarningLimit: 600 },
    server: {
        host: true,
        port: 5173,
        // Si el puerto está ocupado, falla con un aviso en vez de usar otro puerto en silencio.
        strictPort: true,
        proxy: {
            '/api': process.env.GATEWAY_URL || 'http://127.0.0.1:5000'
        }
    }
});
