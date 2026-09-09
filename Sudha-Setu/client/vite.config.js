import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port 5173 matches the backend's default CLIENT_ORIGINS, so server-v2
// needs no CORS change to work with this client.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
