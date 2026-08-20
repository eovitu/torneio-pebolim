/// <reference types="vite/client" />

/**
 * Variáveis de ambiente do frontend. Tudo aqui é PÚBLICO: o prefixo VITE_ faz
 * o valor ser embutido no bundle (§46).
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
