/**
 * Criação de usuário pelo administrador.
 *
 * A service role fica no ambiente da Edge Function, nunca no navegador. A
 * camada HTTP fica em `handler.ts` para que auth, validação, criação e auditoria
 * possam ser testados sem consultar Auth ou Postgres reais.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  criarHandlerAdminCriarUsuario,
  EmailJaCadastradoError,
} from './handler.ts'

const url = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const servico = createClient(url, serviceKey, { auth: { persistSession: false } })

Deno.serve(criarHandlerAdminCriarUsuario({
  autenticar: async (autorizacao) => {
    const comoUsuario = createClient(url, anonKey, {
      global: { headers: { Authorization: autorizacao } },
    })
    const { data, error } = await comoUsuario.auth.getUser()
    return error === null ? data.user?.id ?? null : null
  },
  ehAdmin: async (userId) => {
    const { data, error } = await servico
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
    if (error !== null) throw new Error('admin role lookup failed')
    return (data ?? []).some((papel) => papel.role === 'ADMIN' || papel.role === 'FACTORY_ADMIN')
  },
  criarUsuario: async ({ email, senha, nome }) => {
    const { data, error } = await servico.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    })
    if (error !== null) {
      if (/already been registered|already exists/i.test(error.message)) {
        throw new EmailJaCadastradoError()
      }
      throw new Error('auth user creation failed')
    }
    if (data.user === null) throw new Error('auth user creation returned no user')
    return { id: data.user.id, email: data.user.email ?? email }
  },
  registrarAuditoria: async (actorId, user, nome) => {
    const { error } = await servico.from('admin_audit_log').insert({
      actor_user_id: actorId,
      acao: 'CRIAR_USUARIO',
      entidade: 'auth.users',
      entidade_id: user.id,
      dados_depois: { email: user.email, nome },
    })
    if (error !== null) throw new Error('audit insert failed')
  },
  avisar: (mensagem) => console.warn(mensagem),
}))
