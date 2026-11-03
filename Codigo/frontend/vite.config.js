import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api se reenvía al API Gateway de Flask.
// Se usa 127.0.0.1 y no localhost porque en Windows localhost puede resolver a IPv6.
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/api': process.env.GATEWAY_URL || 'http://127.0.0.1:5000'
        }
    }
});
