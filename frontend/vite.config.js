import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend talks to FastAPI through /api. In dev we proxy to localhost:8000
// so there is no CORS setup needed on the backend during the hackathon.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
