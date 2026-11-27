import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' keeps the build portable (GitHub Pages project site, custom domain, local file preview).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('pptxgenjs')) return 'pptx'
          if (id.includes('pdf-lib') || id.includes('fontkit')) return 'pdf'
          if (id.includes('pdfjs-dist')) return 'pdfjs'
          if (id.includes('mammoth') || id.includes('jszip')) return 'docs'
          if (id.includes('d3-geo') || id.includes('topojson') || id.includes('world-atlas')) return 'maps'
          if (id.includes('react')) return 'react'
        },
      },
    },
  },
})
