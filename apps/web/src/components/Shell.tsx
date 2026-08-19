/**
 * Moldura visual compartilhada pelas páginas: coluna central, cartão de régua
 * de 2px e os textos auxiliares. Todos os valores vêm dos tokens — nenhuma
 * cor, espaçamento ou medida é escrita à mão aqui.
 */

import styled from 'styled-components'

export const Shell = styled.main`
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.space[6]};
`

export const Card = styled.section`
  width: 100%;
  max-width: ${({ theme }) => theme.layout.appMaxWidth};
  border: 2px solid ${({ theme }) => theme.color.divider};
  padding: ${({ theme }) => theme.space[6]};
  background: ${({ theme }) => theme.color.neutral[100]};
`

export const Kicker = styled.p`
  margin: 0;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.accent};
`

export const Note = styled.p`
  margin: ${({ theme }) => theme.space[3]} 0 0;
  font-size: 13px;
  color: ${({ theme }) => theme.color.muted};
`
