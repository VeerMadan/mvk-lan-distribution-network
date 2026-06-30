import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 80,
  },
  preview: {
    host: true,
    port: 80,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/download': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/preview': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/socket.io': { 
        target: 'http://127.0.0.1:3000', 
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            // Silently catch and swallow expected WebSocket disconnects
            if (err.message.includes('ECONNRESET')) return; 
          });
        }
      }
    }
  }
});