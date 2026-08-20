/**
 * Dois defeitos reais encontrados no primeiro uso, fixados aqui para não
 * voltarem.
 *
 * 1. O corpo do modal não rolava. Sendo um item flex sem `min-height: 0`, ele
 *    não encolhia, a caixa estourava a altura máxima e o rodapé — com o botão
 *    de confirmar — saía da tela. No modal de regras isso travava o app
 *    inteiro: não dava para ler até o fim e aceitar.
 *
 * 2. O teclado do celular fechava a cada letra digitada. O efeito de abertura
 *    dependia da callback `aoFechar`, que muda de identidade a cada render;
 *    cada tecla reexecutava o efeito e devolvia o foco ao diálogo.
 *
 * O jsdom não faz layout, então a rolagem em si não é observável. O que dá
 * para verificar — e é onde estava o defeito — são as regras de CSS aplicadas
 * ao elemento e o comportamento do foco.
 */

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { theme } from '../design-system/theme'
import { tokens } from '../design-system/tokens'
import { Modal } from './Modal'
import { ModalRegras } from '../components/ModalRegras'

function comTema(no: React.ReactNode) {
  return render(<ThemeProvider theme={theme}>{no}</ThemeProvider>)
}

afterEach(cleanup)

describe('rolagem do modal', () => {
  it('o corpo pode encolher dentro do flex, senão o rodapé sai da tela', () => {
    comTema(
      <Modal aberto titulo="Teste" aoFechar={vi.fn()} rodape={<button type="button">ok</button>}>
        <p>conteúdo</p>
      </Modal>,
    )

    const corpo = screen.getByText('conteúdo').parentElement as HTMLElement
    const estilo = getComputedStyle(corpo)

    // O jsdom devolve "0" onde o navegador devolve "0px"; o que importa é o zero.
    expect(parseFloat(estilo.minHeight)).toBe(0)
    expect(estilo.overflowY).toBe('auto')
  })

  it('o corpo das regras também encolhe', () => {
    comTema(<ModalRegras onAceitar={vi.fn()} />)

    const estilo = getComputedStyle(screen.getByTestId('regras-corpo'))
    expect(parseFloat(estilo.minHeight)).toBe(0)
    expect(estilo.overflowY).toBe('auto')
  })

  it('o modal de regras fica acima da barra de navegação', () => {
    comTema(<ModalRegras onAceitar={vi.fn()} />)

    const fundo = screen.getByRole('dialog')
    const z = Number(getComputedStyle(fundo).zIndex)
    expect(z).toBeGreaterThan(Number(tokens.zIndex.barra))
  })

  it('trava a rolagem do fundo enquanto está aberto', () => {
    const { unmount } = comTema(<ModalRegras onAceitar={vi.fn()} />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})

/** Reproduz o uso real: `aoFechar` é recriada a cada render. */
function ModalComEstado() {
  const [texto, setTexto] = useState('')
  return (
    <Modal aberto titulo="Criar torneio" aoFechar={() => undefined}>
      <input aria-label="nome" value={texto} onChange={(e) => setTexto(e.target.value)} />
    </Modal>
  )
}

describe('foco dentro do modal', () => {
  it('não rouba o foco do campo a cada tecla digitada', () => {
    comTema(<ModalComEstado />)
    const campo = screen.getByLabelText('nome')

    campo.focus()
    expect(document.activeElement).toBe(campo)

    // Três teclas seguidas: cada uma re-renderiza e recria `aoFechar`.
    fireEvent.change(campo, { target: { value: 'C' } })
    expect(document.activeElement).toBe(campo)

    fireEvent.change(campo, { target: { value: 'Co' } })
    expect(document.activeElement).toBe(campo)

    fireEvent.change(campo, { target: { value: 'Cop' } })
    expect(document.activeElement).toBe(campo)
    expect((campo as HTMLInputElement).value).toBe('Cop')
  })
})
