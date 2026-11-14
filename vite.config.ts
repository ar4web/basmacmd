import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins = [react(), tailwindcss()];
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  const demo = String(env.VITE_DEMO_MODE ?? '') === '1';
  const apiTarget = env.VITE_DEMO_API_URL || 'http://127.0.0.1:8787';

  return {
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
    server: {
      host: '0.0.0.0',
      allowedHosts: true as const,
      // In demo mode the local API server (dev/server.mjs) stands in for /api.
      proxy: demo
        ? {
            '/api': { target: apiTarget, changeOrigin: true },
          }
        : undefined,
    },
  };
});
