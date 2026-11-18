import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Libraries in their own files: they change rarely, so browsers keep them cached across deploys.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (id.includes('node_modules/@supabase/')) return 'supabase'
          return 'vendor'
        },
      },
    },
  },
})
