/**
 * Ciclo de vida da confirmação das regras (decisão do proprietário, 20/08/2026).
 *
 * A regra é "uma vez por SESSÃO/LOGIN", e é justamente aí que dá para errar de
 * dois jeitos opostos: mostrar demais (o modal reaparecendo a cada refresh de
 * token, o que irritaria) ou de menos (a confirmação sobrevivendo ao logout, o
 * que furaria a regra).
 *
 * Estes testes exercitam o `AuthProvider` de verdade, dirigindo os eventos do
 * Supabase Auth na mão. O `PortaoDeRegras` tem testes próprios, com o contexto
 * mockado — aqui o que está sob teste é o contexto em si.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

/** Controle dos eventos de autenticação, para dirigi-los no teste. */
const auth = vi.hoisted(() => ({
  ouvinte: null as ((evento: AuthChangeEvent, s: Session | null) => void) | null,
  sessaoInicial: null as Session | null,
  upserts: [] as unknown[],
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: auth.sessaoInicial } }),
      onAuthStateChange: (cb: (evento: AuthChangeEvent, s: Session | null) => void) => {
        auth.ouvinte = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
    from: () => ({
      upsert: (linha: unknown) => {
        auth.upserts.push(linha)
        return Promise.resolve({ error: null })
      },
    }),
  },
}))

/** Sessão mínima: só o que o provider realmente lê. */
function sessaoDe(id: string): Session {
  return { user: { id, user_metadata: {} } } as Session
}

function Sonda() {
  const { regrasConfirmadasNestaSessao, confirmarRegras } = useAuth()
  return (
    <div>
      <span data-testid="estado">{regrasConfirmadasNestaSessao ? 'confirmado' : 'pendente'}</span>
      <button type="button" onClick={() => void confirmarRegras('1.0.0')}>
        confirmar
      </button>
    </div>
  )
}

function estado() {
  return screen.getByTestId('estado').textContent
}

/** Dispara um evento do Supabase Auth como o cliente real faria. */
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
  localStorage.clear()
})

afterEach(cleanup)

describe('confirmação das regras por sessão', () => {
  it('começa pendente para quem acabou de entrar', async () => {
    await montar(sessaoDe('u1'))
    expect(estado()).toBe('pendente')
  })

  it('fica confirmada depois do aceite', async () => {
    await montar(sessaoDe('u1'))
    await act(async () => {
      screen.getByRole('button', { name: 'confirmar' }).click()
    })
    expect(estado()).toBe('confirmado')
  })

  it('grava o aceite da versão em rules_acceptance', async () => {
    await montar(sessaoDe('u1'))
    await act(async () => {
      screen.getByRole('button', { name: 'confirmar' }).click()
    })
    expect(auth.upserts).toContainEqual({ user_id: 'u1', accepted_rules_version: '1.0.0' })
  })

  it('NÃO reaparece a cada renovação de token da mesma conta', async () => {
    await montar(sessaoDe('u1'))
    await act(async () => {
      screen.getByRole('button', { name: 'confirmar' }).click()
    })
    await emitir('TOKEN_REFRESHED', sessaoDe('u1'))
    expect(estado()).toBe('confirmado')
  })

  it('volta a pendente ao sair', async () => {
    await montar(sessaoDe('u1'))
    await act(async () => {
      screen.getByRole('button', { name: 'confirmar' }).click()
    })
    await emitir('SIGNED_OUT', null)
    expect(estado()).toBe('pendente')
  })

  it('volta a pendente no login seguinte', async () => {
    await montar(sessaoDe('u1'))
    await act(async () => {
      screen.getByRole('button', { name: 'confirmar' }).click()
    })
    await emitir('SIGNED_OUT', null)
    await emitir('SIGNED_IN', sessaoDe('u1'))
    expect(estado()).toBe('pendente')
  })

  it('volta a pendente quando outra conta entra', async () => {
    await montar(sessaoDe('u1'))
    await act(async () => {
      screen.getByRole('button', { name: 'confirmar' }).click()
    })
    await emitir('SIGNED_IN', sessaoDe('u2'))
    expect(estado()).toBe('pendente')
  })

  it('não deixa rastro persistente: nada vai para o localStorage', async () => {
    await montar(sessaoDe('u1'))
    await act(async () => {
      screen.getByRole('button', { name: 'confirmar' }).click()
    })
    expect(localStorage.length).toBe(0)
  })
})
