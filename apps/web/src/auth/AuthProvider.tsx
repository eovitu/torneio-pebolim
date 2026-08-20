/**
 * Provider de sessão.
 *
 * A sessão é restaurada do storage no primeiro render e mantida por
 * `onAuthStateChange` — o resto do app nunca lê o storage diretamente.
 *
 * O estado aqui serve à INTERFACE (o que mostrar, para onde navegar). Ele
 * nunca é fonte de autorização: quem decide o que cada usuário pode fazer é a
 * RLS e as funções do banco (§45). Esconder um botão não protege nada.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './AuthContext'
import type { DadosCadastro } from './AuthContext'
import { ErroAutenticacao, traduzirErroAuth } from './erros'

/**
 * Garante que o aceite das regras esteja registrado para a sessão atual.
 *
 * O aceite acontece no formulário de cadastro, mas a linha em
 * `rules_acceptance` só pode ser gravada com sessão ativa — a policy exige
 * `user_id = auth.uid()`. Quando o projeto exige confirmação de e-mail, não há
 * sessão no momento do cadastro; por isso a versão aceita viaja nos metadados
 * do usuário e a linha é criada assim que a sessão aparece.
 *
 * O unique (user_id, accepted_rules_version) torna a operação idempotente:
 * repetir não duplica.
 */
async function garantirAceiteRegistrado(session: Session): Promise<void> {
  const versao = session.user.user_metadata?.accepted_rules_version
  if (typeof versao !== 'string' || versao === '') return

  const { error } = await supabase
    .from('rules_acceptance')
    .upsert(
      { user_id: session.user.id, accepted_rules_version: versao },
      { onConflict: 'user_id,accepted_rules_version', ignoreDuplicates: true },
    )

  // Falha aqui não deve impedir o uso do app: o aceite continua registrado nos
  // metadados e a próxima sessão tenta de novo.
  if (error) console.error('[auth] falha ao registrar aceite das regras:', error.message)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)
  /**
   * Confirmação das regras nesta sessão de navegador.
   *
   * Mora em memória e não em localStorage de propósito: a decisão do
   * proprietário é que o modal apareça a CADA login. Um valor persistido
   * sobreviveria ao logout e furaria a regra.
   */
  const [regrasConfirmadasNestaSessao, setRegrasConfirmadas] = useState(false)
  /** Usuário da confirmação atual — trocar de conta zera a confirmação. */
  const usuarioConfirmado = useRef<string | null>(null)

  useEffect(() => {
    let ativo = true

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return
      setSession(data.session)
      setCarregando(false)
      if (data.session) void garantirAceiteRegistrado(data.session)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      if (!ativo) return
      setSession(novaSessao)
      setCarregando(false)
      // Sair, ou entrar com outra conta, exige confirmar as regras de novo.
      if (novaSessao === null || novaSessao.user.id !== usuarioConfirmado.current) {
        usuarioConfirmado.current = null
        setRegrasConfirmadas(false)
      }
      if (novaSessao && (evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION')) {
        void garantirAceiteRegistrado(novaSessao)
      }
    })

    return () => {
      ativo = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const entrar = useCallback(async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw new ErroAutenticacao(traduzirErroAuth(error))
  }, [])

  const cadastrar = useCallback(async (dados: DadosCadastro) => {
    const { data, error } = await supabase.auth.signUp({
      email: dados.email,
      password: dados.senha,
      options: {
        // `nome` alimenta o perfil criado pelo trigger handle_new_user;
        // `accepted_rules_version` é lido por garantirAceiteRegistrado.
        data: {
          nome: dados.nome,
          accepted_rules_version: dados.versaoRegrasAceita,
        },
      },
    })
    if (error) throw new ErroAutenticacao(traduzirErroAuth(error))

    // Com confirmação de e-mail ativa, o Supabase responde 200 e uma lista de
    // identidades VAZIA quando o e-mail já existe — de propósito, para não
    // permitir descobrir quem tem conta. Tratamos como "já cadastrado".
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new ErroAutenticacao('Este e-mail já está cadastrado. Tente entrar.')
    }

    return { precisaConfirmarEmail: data.session === null }
  }, [])

  const confirmarRegras = useCallback(
    async (versao: string) => {
      usuarioConfirmado.current = session?.user.id ?? null
      setRegrasConfirmadas(true)

      // O histórico permanente continua em `rules_acceptance`. Contas criadas
      // pelo administrador nunca passaram pelo cadastro e por isso não tinham
      // linha nenhuma; a confirmação na entrada preenche essa lacuna.
      if (session === null) return
      const { error } = await supabase
        .from('rules_acceptance')
        .upsert(
          { user_id: session.user.id, accepted_rules_version: versao },
          { onConflict: 'user_id,accepted_rules_version', ignoreDuplicates: true },
        )
      if (error) console.error('[auth] falha ao registrar aceite das regras:', error.message)
    },
    [session],
  )

  const sair = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new ErroAutenticacao(traduzirErroAuth(error))
  }, [])

  const valor = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      carregando,
      regrasConfirmadasNestaSessao,
      confirmarRegras,
      entrar,
      cadastrar,
      sair,
    }),
    [session, carregando, regrasConfirmadasNestaSessao, confirmarRegras, entrar, cadastrar, sair],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
