/**
 * A trava de rolagem do modal de regras (§17).
 *
 * O jsdom não faz layout: toda medida de rolagem vale 0. Por isso os testes
 * fixam `scrollHeight` e `clientHeight` ANTES da montagem — o componente mede
 * já no primeiro efeito, então injetar depois chegaria tarde. O objetivo é
 * fixar a REGRA (só libera depois de ver o texto inteiro), não medir pixels.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { RULES, RULES_VERSION } from '@pebolim/domain'
import { theme } from '../design-system/theme'
import { ModalRegras } from './ModalRegras'

/** Simula uma caixa cujo conteúdo é maior que a área visível. */
function comOverflow(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight)
}

function montar(props?: { onAceitar?: (v: string) => void; onCancelar?: () => void }) {
  const onAceitar = props?.onAceitar ?? vi.fn()
  const onCancelar = props?.onCancelar ?? vi.fn()
  render(
    <ThemeProvider theme={theme}>
      <ModalRegras onAceitar={onAceitar} onCancelar={onCancelar} />
    </ThemeProvider>,
  )
  return {
    onAceitar,
    onCancelar,
    corpo: screen.getByTestId('regras-corpo'),
    botaoAceitar: screen.getByRole('button', { name: /li e aceito/i }),
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('modal de regras', () => {
  it('mostra todas as seções das regras oficiais', () => {
    montar()
    for (const secao of RULES) {
      expect(screen.getByText(secao.title)).toBeInTheDocument()
    }
    // Uma regra que não pode faltar: o valor do gol de goleiro.
    expect(
      screen.getByText(/gol de goleiro vale 2 — sempre, em placar, saldo/i),
    ).toBeInTheDocument()
  })

  it('mantém o aceite bloqueado enquanto o texto não foi lido até o fim', () => {
    comOverflow(2000, 500)
    const { corpo, botaoAceitar } = montar()

    expect(botaoAceitar).toBeDisabled()
    expect(screen.getByText(/role até o fim/i)).toBeInTheDocument()

    // Metade do caminho ainda não vale.
    corpo.scrollTop = 800
    fireEvent.scroll(corpo)
    expect(botaoAceitar).toBeDisabled()
  })

  it('libera o aceite ao chegar ao fim e informa a versão lida', () => {
    comOverflow(2000, 500)
    const { corpo, botaoAceitar, onAceitar } = montar()

    corpo.scrollTop = 1500
    fireEvent.scroll(corpo)

    expect(botaoAceitar).toBeEnabled()
    expect(screen.queryByText(/role até o fim/i)).not.toBeInTheDocument()

    fireEvent.click(botaoAceitar)
    expect(onAceitar).toHaveBeenCalledExactlyOnceWith(RULES_VERSION)
  })

  it('não destrava antes da hora por arredondamento de alguns pixels', () => {
    // Faltando 20px o botão continua travado; a margem de tolerância é 8px.
    comOverflow(2000, 500)
    const { corpo, botaoAceitar } = montar()

    corpo.scrollTop = 1480
    fireEvent.scroll(corpo)
    expect(botaoAceitar).toBeDisabled()

    // A 4px do fim já conta como fim — zoom e DPI impedem o valor exato.
    corpo.scrollTop = 1496
    fireEvent.scroll(corpo)
    expect(botaoAceitar).toBeEnabled()
  })

  it('libera quando o texto inteiro já cabe na tela, sem rolagem a fazer', () => {
    // Tela alta: não existe rolagem, e exigir rolar travaria a pessoa para sempre.
    comOverflow(600, 600)
    const { botaoAceitar } = montar()
    expect(botaoAceitar).toBeEnabled()
  })

  it('cancela pelo botão e pela tecla Esc', () => {
    const onCancelar = vi.fn()
    montar({ onCancelar })

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onCancelar).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancelar).toHaveBeenCalledTimes(2)
  })
})
