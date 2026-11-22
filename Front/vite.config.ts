import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import type { ProxyOptions } from 'vite'
import { defineConfig } from 'vitest/config'

const apiProxy: Record<string, ProxyOptions> = {
  '/api': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
    configure(proxy) {
      proxy.on('proxyReq', (proxyRequest) => {
        // Same-origin browser requests do not need backend CORS. Removing these
        // headers also keeps LAN origins out of the backend allowlist.
        proxyRequest.removeHeader('origin')
        proxyRequest.removeHeader('referer')
      })
    },
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:5173/',
      },
    },
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/api/generated/**'],
    },
  },
})
