/**
 * O portão das regras (decisão do proprietário, 20/08/2026).
 *
 * A regra que estes testes fixam: quem tem sessão precisa confirmar as regras
 * uma vez por sessão antes de usar o app; quem não tem conta passa direto,
 * porque o visitante só lê conteúdo público (§40).
 *
 * Como no ModalRegras, o jsdom não faz layout: as medidas de rolagem são
 * fixadas antes da montagem para que a trava de "leu até o fim" possa ser
 * exercitada.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import type { EstadoAutenticacao } from '../auth/AuthContext'
import { theme } from '../design-system/theme'
import { PortaoDeRegras } from './PortaoDeRegras'

const estado = vi.hoisted(() => ({ atual: {} as EstadoAutenticacao }))

vi.mock('../auth/useAuth', () => ({ useAuth: () => estado.atual }))

function montar(parcial: Partial<EstadoAutenticacao>) {
  const confirmarRegras = vi.fn(async () => {})
  estado.atual = {
    session: null,
    user: null,
    carregando: false,
    regrasConfirmadasNestaSessao: false,
    confirmarRegras,
    entrar: vi.fn(),
    cadastrar: vi.fn(),
    sair: vi.fn(),
    ...parcial,
  } as EstadoAutenticacao

  render(
    <ThemeProvider theme={theme}>
      <PortaoDeRegras>
        <p>conteúdo do app</p>
      </PortaoDeRegras>
    </ThemeProvider>,
  )
  return { confirmarRegras }
}

/** Simula uma caixa cujo conteúdo cabe inteiro — não há rolagem a fazer. */
function semOverflow() {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(300)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('PortaoDeRegras', () => {
  it('não barra o visitante sem conta', () => {
    montar({ session: null })
    expect(screen.getByText('conteúdo do app')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('exige confirmação de quem tem sessão e ainda não confirmou', () => {
    semOverflow()
    montar({ session: { user: { id: 'u1' } } as never })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /regras oficiais/i })).toBeInTheDocument()
  })

  it('não mostra o modal de novo depois de confirmado na sessão', () => {
    montar({ session: { user: { id: 'u1' } } as never, regrasConfirmadasNestaSessao: true })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('registra a confirmação ao aceitar', () => {
    semOverflow()
    const { confirmarRegras } = montar({ session: { user: { id: 'u1' } } as never })
    fireEvent.click(screen.getByRole('button', { name: /li e aceito/i }))
    expect(confirmarRegras).toHaveBeenCalledTimes(1)
  })

  it('não oferece saída: o modal obrigatório não tem cancelar', () => {
    semOverflow()
    montar({ session: { user: { id: 'u1' } } as never })
    expect(screen.queryByRole('button', { name: /cancelar/i })).toBeNull()
  })
})
