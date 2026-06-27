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
    allowedHosts: true // <-- THIS IS THE MAGIC KEY
  }
});