import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allows network access
    allowedHosts: ['admin.mvk.in'] // Tells Vite to accept your custom DNS
  }
})