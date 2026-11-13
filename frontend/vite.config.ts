import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001'

export default defineConfig({
  plugins: [vue()],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    include: ['jsxgraph'],
    exclude: ['markdown-it-mathjax3'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['freedom-developer.top', '123.207.243.77'],
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
