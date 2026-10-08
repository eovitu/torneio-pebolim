import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { RULES_VERSION } from '@pebolim/domain'
import { theme } from '../design-system/theme'
import Cadastro from './Cadastro'

const auth = vi.hoisted(() => ({ cadastrar: vi.fn() }))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    cadastrar: auth.cadastrar,
    session: null,
    carregando: false,
  }),
}))

function montar() {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <Cadastro />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

function preencherCadastro() {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Pati' } })
  fireEvent.change(screen.getByLabelText('E-mail'), {
    target: { value: 'pati@example.test' },
  })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha123' } })
}

beforeEach(() => {
  auth.cadastrar.mockReset()
  auth.cadastrar.mockResolvedValue({ precisaConfirmarEmail: true })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('aceite no cadastro', () => {
  it('impede criar conta antes de aceitar as regras', async () => {
    montar()
    preencherCadastro()

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(
      await screen.findByText('É preciso ler e aceitar as regras para se cadastrar.'),
    ).toBeInTheDocument()
    expect(auth.cadastrar).not.toHaveBeenCalled()
  })

  it('só envia a versão aceita depois de rolar as regras até o fim', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(2000)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500)
    montar()
    preencherCadastro()

    fireEvent.click(screen.getByRole('checkbox'))
    const corpo = screen.getByTestId('regras-corpo')
    const aceitar = screen.getByRole('button', { name: /li e aceito/i })
    expect(aceitar).toBeDisabled()

    corpo.scrollTop = 1500
    fireEvent.scroll(corpo)
    expect(aceitar).toBeEnabled()
    fireEvent.click(aceitar)

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => {
      expect(auth.cadastrar).toHaveBeenCalledWith({
        nome: 'Pati',
        email: 'pati@example.test',
        senha: 'senha123',
        versaoRegrasAceita: RULES_VERSION,
      })
    })
  })
})
