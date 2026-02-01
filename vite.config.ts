import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-core': ['react', 'react-dom', 'react-is'],
          'vendor-ui': ['lucide-react', 'react-tooltip'],
          'vendor-data': ['xlsx', '@supabase/supabase-js'],
          'vendor-charts': ['recharts', 'react-simple-maps', 'd3-scale'],
        }
      }
    },
    chunkSizeWarningLimit: 1000 // Increase limit slightly to reduce noise if chunks are still ~600kb
  }
})
