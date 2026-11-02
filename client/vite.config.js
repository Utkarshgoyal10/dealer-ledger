import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo.png', 'apple-touch-icon.png', 'push-sw.js'],
      manifest: {
        name: 'itel Dealer Ledger',
        short_name: 'Dealer Ledger',
        description: 'Sales, returns, payments and schemes ledger for itel dealers',
        theme_color: '#fa023e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app shell is cached. API data (money!) is always fetched live.
        navigateFallbackDenylist: [/^\/api/],
        // Push notification handlers (public/push-sw.js)
        importScripts: ['/push-sw.js'],
      },
      // Service worker also runs in `npm run dev`, so notifications can be tested locally
      devOptions: { enabled: true },
    }),
  ],
  server: {
    proxy: { '/api': 'http://localhost:5000' },
  },
});
