/**
 * Client Supabase do navegador.
 *
 * A chave usada aqui é a anon/publishable: ela é PÚBLICA por natureza e vai
 * embutida no bundle. Quem protege os dados é a Row Level Security do banco,
 * nunca o sigilo desta chave (§46). A service role key jamais entra aqui.
 *
 * O client é tipado pelo schema gerado, então uma coluna renomeada no banco
 * vira erro de compilação em vez de `undefined` em produção.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Falhar aqui, no carregamento, é melhor do que deixar cada chamada quebrar
  // com um erro de rede opaco mais adiante.
  throw new Error(
    'Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY ' +
      'em apps/web/.env.local (veja .env.example).',
  )
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
