/**
 * Fumaça das telas principais.
 *
 * Não verifica conteúdo: verifica que cada tela MONTA sem estourar, com o
 * banco devolvendo listas vazias. É o estado mais comum de um app novo — e é
 * exatamente onde um `undefined` esquecido derruba a página inteira.
 *
 * O client do Supabase é substituído por um encadeador que responde vazio a
 * qualquer consulta. Nenhuma regra do domínio é simulada aqui: as regras já
 * têm testes próprios em `packages/domain`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { theme } from '../design-system/theme'

/** Objeto que responde a qualquer método do PostgREST devolvendo vazio. */
const consultaVazia = vi.hoisted(() => {
  const resultado = { data: [], error: null }
  const alvo: Record<string, unknown> = {}
  const encadeador: unknown = new Proxy(alvo, {
    get(_, prop) {
      if (prop === 'then') {
        return (resolver: (v: unknown) => unknown) => Promise.resolve(resultado).then(resolver)
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return () => Promise.resolve({ data: null, error: null })
      }
      return () => encadeador
    },
  })
  return encadeador
})

vi.mock('../lib/supabase', () => {
  const canal = {
    on: () => canal,
    subscribe: () => canal,
  }
  return {
    supabase: {
      from: () => consultaVazia,
      rpc: () => Promise.resolve({ data: null, error: null }),
      channel: () => canal,
      removeChannel: () => Promise.resolve('ok'),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        onAuthStateChange: () => ({ subscription: { unsubscribe: () => {} } }),
      },
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  }
})

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    session: null,
    user: null,
    carregando: false,
    regrasConfirmadasNestaSessao: true,
    confirmarRegras: vi.fn(),
    entrar: vi.fn(),
    cadastrar: vi.fn(),
    sair: vi.fn(),
  }),
}))

vi.mock('../auth/usePapeis', () => ({
  usePapeis: () => ({ papeis: [], carregando: false, ehAdmin: false, ehAdminDeFabrica: false }),
}))

async function montar(
  caminho: string,
  importar: () => Promise<{ default: React.ComponentType }>,
  padrao?: string,
) {
  const { default: Tela } = await importar()
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[caminho]}>
        <Routes>
          <Route path={padrao ?? caminho} element={<Tela />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

afterEach(cleanup)

describe('telas principais montam com o banco vazio', () => {
  it('Home', async () => {
    await montar('/home', () => import('./Home'))
    expect(await screen.findByRole('heading', { name: /torneio pebolim/i })).toBeInTheDocument()
  })

  it('Torneios', async () => {
    await montar('/tournaments', () => import('./Torneios'))
    expect(await screen.findByRole('heading', { name: /^torneios$/i })).toBeInTheDocument()
  })

  it('Times', async () => {
    await montar('/teams', () => import('./Times'))
    expect(await screen.findByRole('heading', { name: /^times$/i })).toBeInTheDocument()
  })

  it('Partidas', async () => {
    await montar('/matches', () => import('./Partidas'))
    expect(await screen.findByRole('heading', { name: /^partidas$/i })).toBeInTheDocument()
  })

  it('Regras', async () => {
    await montar('/rules', () => import('./Regras'))
    expect(await screen.findByRole('heading', { name: /regras oficiais/i })).toBeInTheDocument()
  })

  // Telas de detalhe: com o banco vazio elas caem no estado "não encontrado",
  // que é justamente o caminho onde um acesso a campo inexistente quebraria.
  it('Torneio inexistente', async () => {
    await montar('/tournaments/abc', () => import('./Torneio'), '/tournaments/:id')
    expect(await screen.findByRole('heading', { name: /não encontrado/i })).toBeInTheDocument()
  })

  it('Time inexistente', async () => {
    await montar('/teams/abc', () => import('./Time'), '/teams/:id')
    expect(await screen.findByRole('heading', { name: /não encontrado/i })).toBeInTheDocument()
  })

  it('Partida inexistente', async () => {
    await montar('/matches/abc', () => import('./Partida'), '/matches/:id')
    expect(await screen.findByRole('heading', { name: /não encontrada/i })).toBeInTheDocument()
  })

  it('Jogador inexistente', async () => {
    await montar('/players/abc', () => import('./Jogador'), '/players/:id')
    expect(await screen.findByRole('heading', { name: /não encontrado/i })).toBeInTheDocument()
  })
})
