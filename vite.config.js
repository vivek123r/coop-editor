import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  define: {
    // Make environment variables available to client code
    'import.meta.env.PROD': JSON.stringify(process.env.NODE_ENV === 'production')
  }
})
