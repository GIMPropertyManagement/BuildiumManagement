import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * In `npm run dev`, requests to /api/buildium/* are transparently forwarded
 * to api.buildium.com with the credential headers injected from .env. This
 * lets the app run against the real Buildium API without deploying the
 * Amplify Lambda first. The credentials live only in the Vite node process;
 * they never ship in the client bundle (no VITE_ prefix) and never touch
 * the browser.
 */
export default defineConfig(({ mode }) => {
  // Pass '' so every key is loaded, not just VITE_-prefixed ones.
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.BUILDIUM_BASE_URL || 'https://api.buildium.com';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/buildium': {
          target,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/buildium/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.BUILDIUM_CLIENT_ID) {
                proxyReq.setHeader('x-buildium-client-id', env.BUILDIUM_CLIENT_ID);
              }
              if (env.BUILDIUM_CLIENT_SECRET) {
                proxyReq.setHeader(
                  'x-buildium-client-secret',
                  env.BUILDIUM_CLIENT_SECRET,
                );
              }
              proxyReq.setHeader('Accept', 'application/json');
            });
            proxy.on('error', (err) => {
              console.error('[buildium-proxy]', err.message);
            });
          },
        },
      },
    },
  };
});
