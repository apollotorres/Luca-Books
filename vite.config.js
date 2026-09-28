import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      ignored: ['**/.agents/**', '**/node_modules/**', '**/.git/**', '**/dist/**']
    },
    proxy: {
      '/api/py': {
        target: 'http://localhost:3089',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/py/, '')
      },
      '/api': {
        target: 'http://localhost:3088',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
