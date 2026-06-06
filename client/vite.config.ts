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
    strictPort: true, // This forces Vite to crash if Port 80 is taken, rather than silently switching to 5173
    allowedHosts: ['mvk-network.in']
  }
});