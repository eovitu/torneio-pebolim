import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

const auth = vi.hoisted(() => ({
  session: null as Session | null,
  listener: null as ((event: AuthChangeEvent, session: Session | null) => void) | null,
  upserts: [] as unknown[],
}))

vi.mock('./lib/supabase', () => {
  const consulta: {
    select: () => typeof consulta
    eq: () => typeof consulta
    upsert: (linha: unknown) => Promise<{ error: null }>
    then: (resolver: (resultado: { data: unknown[]; error: null }) => unknown) => Promise<unknown>
  } = {
    select: () => consulta,
    eq: () => consulta,
    upsert: (linha) => {
      auth.upserts.push(linha)
      return Promise.resolve({ error: null })
    },
    then: (resolver) => Promise.resolve({ data: [], error: null }).then(resolver),
  }

  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: auth.session } }),
        onAuthStateChange: (listener: typeof auth.listener) => {
          auth.listener = listener
          return { data: { subscription: { unsubscribe: () => {} } } }
        },
        signOut: () => Promise.resolve({ error: null }),
      },
      from: () => consulta,
    },
  }
})

beforeEach(() => {
  auth.session = null
  auth.listener = null
  auth.upserts = []
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('regras na navegação autenticada', () => {
  it('permite abrir /rules sem exibir diálogo nem registrar aceite no login', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    render(
      <MemoryRouter initialEntries={['/rules']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /regras oficiais/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const emitir = async (evento: AuthChangeEvent, sessao: Session | null) => {
      await act(async () => {
        auth.listener?.(evento, sessao)
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    }

    await emitir('SIGNED_IN', { user: { id: 'u1', user_metadata: {} } } as Session)
    await emitir('TOKEN_REFRESHED', { user: { id: 'u1', user_metadata: {} } } as Session)
    await emitir('SIGNED_OUT', null)
    await emitir('SIGNED_IN', { user: { id: 'u2', user_metadata: {} } } as Session)

    expect(auth.upserts).toEqual([])
  })
})
