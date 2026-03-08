import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Quorum · AI 群聊讨论室',
        short_name: 'Quorum',
        description: '多模型圆桌讨论，达成 AI 共识',
        theme_color: '#0d0d0d',
        background_color: '#030303',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // API 请求：网络优先，离线回退缓存
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1天
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1年
              },
            },
          },
          {
            // Google Fonts 字体文件
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            // KaTeX CSS / fonts
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/katex.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'katex-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase（体积较大，单独拆分）
          'vendor-supabase': ['@supabase/supabase-js'],
          // Markdown 渲染 + 代码高亮（刚加的，也是大块）
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-highlight', 'highlight.js'],
          // 图标库
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
