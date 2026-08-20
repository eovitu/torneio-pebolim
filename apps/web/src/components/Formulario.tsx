/**
 * Peças de formulário. Estilo mínimo, só o suficiente para ser legível e
 * utilizável no celular — a linguagem visual definitiva virá do protótipo em
 * `project/`. Todos os valores saem dos tokens (§42).
 */

import styled from 'styled-components'

export const Formulario = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
  margin-top: ${({ theme }) => theme.space[6]};
`

export const Campo = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.muted};
`

export const Entrada = styled.input`
  /* 16px evita o zoom automático do iOS ao focar o campo (§43). */
  font: inherit;
  font-size: 16px;
  text-transform: none;
  letter-spacing: normal;
  color: ${({ theme }) => theme.color.text};
  background: ${({ theme }) => theme.color.neutral[100]};
  border: 2px solid ${({ theme }) => theme.color.divider};
  padding: ${({ theme }) => theme.space[3]};
  /* Alvo de toque confortável. */
  min-height: 48px;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.accent};
    outline-offset: 2px;
  }

  &:disabled {
    color: ${({ theme }) => theme.color.muted};
    background: ${({ theme }) => theme.color.surface};
  }
`

export const Botao = styled.button`
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  min-height: 52px;
  padding: ${({ theme }) => theme.space[3]} ${({ theme }) => theme.space[4]};
  border: 2px solid ${({ theme }) => theme.color.text};
  background: ${({ theme }) => theme.color.text};
  color: ${({ theme }) => theme.color.neutral[100]};
  cursor: pointer;

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    background: ${({ theme }) => theme.color.accent};
    border-color: ${({ theme }) => theme.color.accent};
  }

  &:disabled {
    cursor: not-allowed;
    background: ${({ theme }) => theme.color.neutral[400]};
    border-color: ${({ theme }) => theme.color.neutral[400]};
  }
`

export const BotaoSecundario = styled(Botao)`
  background: transparent;
  color: ${({ theme }) => theme.color.text};

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    color: ${({ theme }) => theme.color.neutral[100]};
  }
`

/** Erro do formulário inteiro. `role="alert"` faz o leitor de tela anunciar. */
export const Alerta = styled.p.attrs({ role: 'alert' })`
  margin: 0;
  padding: ${({ theme }) => theme.space[3]};
  border: 2px solid ${({ theme }) => theme.color.accent};
  background: ${({ theme }) => theme.color.accentRamp[100]};
  color: ${({ theme }) => theme.color.accentRamp[700]};
  font-size: 13px;
`

export const Aviso = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.space[3]};
  border: 2px solid ${({ theme }) => theme.color.divider};
  background: ${({ theme }) => theme.color.surface};
  font-size: 13px;
`

/** Erro de um campo específico. */
export const ErroCampo = styled.span`
  font-size: 11px;
  font-weight: 500;
  letter-spacing: normal;
  text-transform: none;
  color: ${({ theme }) => theme.color.accentRamp[700]};
`

export const LinhaAlternativa = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.color.muted};

  a {
    color: ${({ theme }) => theme.color.accent};
    font-weight: 600;
  }
`
