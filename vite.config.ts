import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('msw') || id.includes('@mswjs')) return 'mocks-vendor'
            if (id.includes('@tanstack')) return 'tanstack'
            if (id.includes('react')) return 'react'
          }
          return undefined
        },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
})
