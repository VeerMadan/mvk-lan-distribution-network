import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const getKey = () => {
  const p1 = path.resolve(__dirname, './key.pem');
  if (fs.existsSync(p1)) return fs.readFileSync(p1);
  const p2 = path.resolve(__dirname, '../server/192.168.88.50+2-key.pem');
  if (fs.existsSync(p2)) return fs.readFileSync(p2);
  return Buffer.from('');
};
const getCert = () => {
  const p1 = path.resolve(__dirname, './cert.pem');
  if (fs.existsSync(p1)) return fs.readFileSync(p1);
  const p2 = path.resolve(__dirname, '../server/192.168.88.50+2.pem');
  if (fs.existsSync(p2)) return fs.readFileSync(p2);
  return Buffer.from('');
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 443,
    https: {
      key: getKey(),
      cert: getCert(),
    }
  },
  preview: {
    host: true,
    port: 443,
    strictPort: true,
    allowedHosts: true,
    https: {
      key: getKey(),
      cert: getCert(),
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