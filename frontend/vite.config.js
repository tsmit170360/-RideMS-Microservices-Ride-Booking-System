import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      // Docker Desktop bind mounts don't reliably deliver native fs-change
      // events into the container, so fall back to polling there.
      usePolling: process.env.DOCKER === 'true',
    },
  },
})
