import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { spawn } from 'child_process';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'start-express-server',
        configureServer(server) {
          const proc = spawn('npx', ['tsx', 'server.ts', '3001'], {
            stdio: 'inherit',
            shell: true,
            env: { ...process.env, NODE_ENV: 'development' }
          });
          server.httpServer?.on('close', () => {
            proc.kill();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        }
      }
    },
  };
});
