/**
 * A autenticação só registra versões aceitas que vieram do cadastro. Login,
 * restauração de sessão e renovação de token não representam um novo aceite.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

const auth = vi.hoisted(() => ({
  ouvinte: null as ((evento: AuthChangeEvent, s: Session | null) => void) | null,
  sessaoInicial: null as Session | null,
  upserts: [] as unknown[],
  cadastros: [] as unknown[],
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: auth.sessaoInicial } }),
      onAuthStateChange: (cb: (evento: AuthChangeEvent, s: Session | null) => void) => {
        auth.ouvinte = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      signUp: (dados: unknown) => {
        auth.cadastros.push(dados)
        return Promise.resolve({
          data: { user: { id: 'novo', identities: [{}] }, session: null },
          error: null,
        })
      },
      signInWithPassword: () => Promise.resolve({ error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      upsert: (linha: unknown) => {
        auth.upserts.push(linha)
        return Promise.resolve({ error: null })
      },
    }),
  },
}))

function sessaoDe(id: string, versaoAceita?: string): Session {
  return {
    user: {
      id,
      user_metadata: versaoAceita === undefined ? {} : { accepted_rules_version: versaoAceita },
    },
  } as Session
}

function Sonda() {
  const { user, cadastrar } = useAuth()
  return (
    <div>
      <span data-testid="usuario">{user?.id ?? 'sem sessão'}</span>
      <button
        type="button"
        onClick={() =>
          void cadastrar({
            nome: 'Pessoa Nova',
            email: 'pessoa@example.test',
            senha: 'senha-segura',
            versaoRegrasAceita: '1.0.0',
          })
        }
      >
        cadastrar
      </button>
    </div>
  )
}

async function emitir(evento: AuthChangeEvent, sessao: Session | null) {
  await act(async () => {
    auth.ouvinte?.(evento, sessao)
  })
}

async function montar(sessaoInicial: Session | null) {
  auth.sessaoInicial = sessaoInicial
  await act(async () => {
    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    )
  })
  await emitir('INITIAL_SESSION', sessaoInicial)
}

beforeEach(() => {
  auth.ouvinte = null
  auth.upserts = []
  auth.cadastros = []
  auth.sessaoInicial = null
})

afterEach(cleanup)

describe('aceite das regras na autenticação', () => {
  it('restaura uma sessão sem metadata de aceite sem gravar aceite novo', async () => {
    await montar(sessaoDe('u1'))

    expect(screen.getByTestId('usuario')).toHaveTextContent('u1')
    expect(auth.upserts).toEqual([])
  })

  it('login, troca de conta e renovação sem metadata não criam aceite', async () => {
    await montar(null)

    await emitir('SIGNED_IN', sessaoDe('u1'))
    await emitir('TOKEN_REFRESHED', sessaoDe('u1'))
    await emitir('SIGNED_OUT', null)
    await emitir('SIGNED_IN', sessaoDe('u2'))

    expect(screen.getByTestId('usuario')).toHaveTextContent('u2')
    expect(auth.upserts).toEqual([])
  })

  it('reconcilia somente a versão previamente aceita no metadata da sessão', async () => {
    await montar(sessaoDe('u1', '1.0.0'))

    expect(auth.upserts).toContainEqual({
      user_id: 'u1',
      accepted_rules_version: '1.0.0',
    })
  })

  it('envia ao Supabase a versão lida e aceita explicitamente no cadastro', async () => {
    await montar(null)
    await act(async () => {
      screen.getByRole('button', { name: 'cadastrar' }).click()
    })

    expect(auth.cadastros).toContainEqual({
      email: 'pessoa@example.test',
      password: 'senha-segura',
      options: {
        data: { nome: 'Pessoa Nova', accepted_rules_version: '1.0.0' },
      },
    })
  })
})
