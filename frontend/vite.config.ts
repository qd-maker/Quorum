import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
