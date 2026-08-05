import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 443,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, './key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, './cert.pem')),
    }
  },
  preview: {
    host: true,
    port: 443,
    strictPort: true,
    allowedHosts: true,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, './key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, './cert.pem')),
    },
    proxy: {
      '/api': { target: 'https://127.0.0.1:3000', changeOrigin: true, secure: false },
      '/download': { target: 'https://127.0.0.1:3000', changeOrigin: true, secure: false },
      '/preview': { target: 'https://127.0.0.1:3000', changeOrigin: true, secure: false },
      '/socket.io': { 
        target: 'https://127.0.0.1:3000', 
        secure: false, 
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