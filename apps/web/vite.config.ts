import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * As dependências grandes vão para pedaços próprios.
 *
 * Sem isso, o Rollup mistura React, Supabase e o design system no mesmo
 * arquivo que a navegação: qualquer ajuste de tela invalida o cache do
 * navegador inteiro. Separados, uma mudança de UI baixa alguns kB em vez de
 * quase 300 (§44).
 */
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('lucide-react')) return 'icones'
          if (id.includes('styled-components') || id.includes('stylis')) return 'estilo'
          if (id.includes('react-router') || id.includes('/react-dom/') || id.includes('/react/')) {
            return 'react'
          }
          return undefined
        },
      },
    },
  },
})
