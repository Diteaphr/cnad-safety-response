import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // 只載入 CNAD_*（例如 CNAD_API_PROXY_TARGET）。env 檔請放在 frontend/（預設專案根即此）。
  const cnadEnv = loadEnv(mode, '.', 'CNAD_');
  const proxyTarget = cnadEnv.CNAD_API_PROXY_TARGET || 'http://127.0.0.1:8000';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: true },
        manifest: {
          name: 'Employee Safety & Response System',
          short_name: 'SafetyApp',
          description: 'Mission-critical platform for emergency safety reporting',
          theme_color: '#D32F2F',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
      }),
    ],
    server: {
      host: '0.0.0.0',
      port: 3000,
      // 開發時可走同源 `/api/*`，由此轉到本機 CNAD uvicorn。
      // 若要改後端監聽位址：frontend/.env.local 設 CNAD_API_PROXY_TARGET（勿結尾 `/`），見 .env.example。
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
