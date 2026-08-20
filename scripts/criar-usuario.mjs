#!/usr/bin/env node
/**
 * Cria um usuário já confirmado, para o bootstrap do primeiro administrador.
 *
 * A tela de administração cobre o caso normal, mas ela exige um admin logado —
 * e o PRIMEIRO admin não tem quem o crie. Este script existe só para esse
 * momento (e para uma emergência em que ninguém consiga entrar).
 *
 * A service role key ignora toda a RLS. Ela NÃO fica no repositório e não deve
 * ser colada em lugar nenhum além do seu terminal: o script a lê do ambiente.
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_URL = "https://fgbpeuanyoefjcywhvkh.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<sua service role key>"
 *   node scripts/criar-usuario.mjs "vitinho" "vhzzlk@gmail.com" "Vitu2306!"
 *
 * Uso (bash):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/criar-usuario.mjs "vitinho" "vhzzlk@gmail.com" "Vitu2306!"
 *
 * Depois de rodar, feche o terminal ou limpe a variável — ela fica no
 * histórico da sessão.
 */

const url = process.env.SUPABASE_URL
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
const [nome, email, senha] = process.argv.slice(2)

if (!url || !chave) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.')
  process.exit(1)
}
if (!nome || !email || !senha) {
  console.error('Uso: node scripts/criar-usuario.mjs "<nome>" "<email>" "<senha>"')
  process.exit(1)
}

const resposta = await fetch(`${url}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: chave,
    Authorization: `Bearer ${chave}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email,
    password: senha,
    // Pula a confirmação por e-mail: o dono distribui a senha pessoalmente.
    email_confirm: true,
    user_metadata: { nome },
  }),
})

const corpo = await resposta.json()

if (!resposta.ok) {
  console.error(`Falhou (${resposta.status}):`, corpo.msg ?? corpo.error ?? corpo)
  process.exit(1)
}

console.log(`Criado: ${corpo.email}  id=${corpo.id}`)
console.log('O perfil e o papel são criados pelo trigger handle_new_user.')
