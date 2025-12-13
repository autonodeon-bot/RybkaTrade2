import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // Используем '.' вместо process.cwd(), чтобы избежать ошибок типов, если @types/node не подключены
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env to avoid "ReferenceError: process is not defined" in some libraries
      'process.env': {},
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    build: {
      outDir: 'dist',
    },
    server: {
      // Setup proxy for local development to avoid CORS or 404s on API calls
      proxy: {
        '/api': {
          target: 'http://localhost:3000', // Assuming backend runs here or mock it
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    }
  };
});