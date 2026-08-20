/**
 * Criação de usuário pelo administrador.
 *
 * Existe porque `auth.admin.createUser` exige a service role key, que jamais
 * pode ir para o navegador — ela ignora toda a RLS. Aqui a chave fica no
 * ambiente da Edge Function, injetada pela plataforma, e nunca sai daqui.
 *
 * `email_confirm: true` cria a conta já confirmada: o dono distribui a senha
 * padrão e a pessoa entra direto, sem depender de e-mail de confirmação.
 *
 * Quem chama precisa ser administrador — verificado pelo JWT de quem chamou,
 * não por um parâmetro que o cliente possa forjar.
 *
 * Este arquivo roda em Deno, não no bundle do frontend; por isso fica fora de
 * `apps/web` e não passa pelo typecheck do workspace.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ erro: 'método não permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const autorizacao = req.headers.get('Authorization') ?? ''
  if (autorizacao === '') return responder({ erro: 'não autenticado' }, 401)

  // Identidade de quem chamou, a partir do próprio token.
  const comoUsuario = createClient(url, anonKey, {
    global: { headers: { Authorization: autorizacao } },
  })
  const { data: quem, error: erroUsuario } = await comoUsuario.auth.getUser()
  if (erroUsuario || !quem.user) return responder({ erro: 'não autenticado' }, 401)

  const servico = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: papeis } = await servico
    .from('user_roles')
    .select('role')
    .eq('user_id', quem.user.id)

  const ehAdmin = (papeis ?? []).some((p) => p.role === 'ADMIN' || p.role === 'FACTORY_ADMIN')
  if (!ehAdmin) return responder({ erro: 'somente administrador pode criar usuários' }, 403)

  let corpo: { nome?: string; email?: string; senha?: string }
  try {
    corpo = await req.json()
  } catch {
    return responder({ erro: 'corpo inválido' }, 400)
  }

  const nome = (corpo.nome ?? '').trim()
  const email = (corpo.email ?? '').trim().toLowerCase()
  const senha = corpo.senha ?? ''

  if (nome.length < 2) return responder({ erro: 'informe o nome (mínimo 2 caracteres)' }, 400)
  if (!email.includes('@')) return responder({ erro: 'informe um e-mail válido' }, 400)
  if (senha.length < 6) return responder({ erro: 'a senha precisa ter ao menos 6 caracteres' }, 400)

  const { data: criado, error: erroCriacao } = await servico.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    // `nome` alimenta o perfil criado pelo trigger handle_new_user.
    user_metadata: { nome },
  })

  if (erroCriacao) {
    const jaExiste = /already been registered|already exists/i.test(erroCriacao.message)
    return responder(
      { erro: jaExiste ? 'este e-mail já está cadastrado' : erroCriacao.message },
      jaExiste ? 409 : 400,
    )
  }

  // Trilha de auditoria: criar conta é ação administrativa (§48).
  await servico.from('admin_audit_log').insert({
    actor_user_id: quem.user.id,
    acao: 'CRIAR_USUARIO',
    entidade: 'auth.users',
    entidade_id: criado.user?.id ?? null,
    dados_depois: { email, nome },
  })

  return responder({ id: criado.user?.id, email: criado.user?.email, nome })
})
