import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiPort = process.env.PORT ?? 3001

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Follows PORT so the proxy does not go stale when the API moves.
      '/api': `http://127.0.0.1:${apiPort}`,
    },
  },
  build: {
    // Keep the framework in its own chunk: it changes far less often than app code, so it
    // stays cached across deploys instead of being invalidated by every release.
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) only accepts the function form here.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (
            /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(
              id,
            )
          ) {
            return 'react'
          }
          return undefined
        },
      },
    },
  },
})
