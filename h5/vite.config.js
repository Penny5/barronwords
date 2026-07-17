import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function resolveBase() {
  if (process.env.VITE_BASE_PATH) return process.env.VITE_BASE_PATH;
  if (process.env.GITHUB_ACTIONS) {
    const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
    if (repo) return `/${repo}/`;
  }
  return './';
}

const base = resolveBase();

export default defineConfig({
  base,
  server: {
    port: 5199,
    host: true,
    strictPort: false,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: "Barron 1100 词汇训练",
        short_name: 'Barron 1100',
        description: "Barron's 1100 Words 个人词汇训练营",
        theme_color: '#0F2744',
        background_color: '#F8F6F1',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        lang: 'zh-CN',
        icons: [
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,json,woff2}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
  },
});
