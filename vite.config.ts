import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = (env.VITE_SITE_URL || process.env.VITE_SITE_URL || '').replace(/\/+$/, '');

  if (command === 'build' && !siteUrl) {
    throw new Error('ERROR: VITE_SITE_URL is required for build. Please set VITE_SITE_URL in your environment or .env file.');
  }

  // Ensure process.env has normalized VITE_SITE_URL for Vite's %VITE_SITE_URL% HTML replacement
  if (siteUrl) {
    process.env.VITE_SITE_URL = siteUrl;
  }

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'favicon.ico',
          'favicon.svg',
          'favicon-32x32.png',
          'favicon.png',
          'apple-touch-icon.png',
          'og-image.png',
          'robots.txt',
          'sitemap.xml',
          'quran.svg',
          'fonts/fonts.css',
          'fonts/*.woff2',
        ],
        manifest: {
        name: 'متشابهات القرآن',
        short_name: 'متشابهات القرآن',
        description: 'منصة الحفاظ الخاصة لدراسة وتتبع المتشابهات القرآنية',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FAF7F0',
        theme_color: '#0F5C4A',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5192',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:5192',
        changeOrigin: true,
        secure: false,
      },
    },
  },
};
});

