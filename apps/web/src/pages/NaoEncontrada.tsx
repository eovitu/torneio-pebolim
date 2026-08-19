/**
 * Rota catch-all. Substitui a tela de erro genérica da hospedagem por uma
 * página nossa, na mesma linguagem visual do restante do app.
 */

import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { Card, Kicker, Note, Shell } from '../components/Shell'

const Codigo = styled.p`
  margin: ${({ theme }) => theme.space[4]} 0 0;
  font-family: ${({ theme }) => theme.font.heading};
  font-weight: ${({ theme }) => theme.font.headingWeight};
  font-size: 64px;
  line-height: 1;
  color: ${({ theme }) => theme.color.accent};
`

const Voltar = styled(Link)`
  display: inline-block;
  margin-top: ${({ theme }) => theme.space[6]};
  padding: ${({ theme }) => theme.space[3]} ${({ theme }) => theme.space[4]};
  border: 2px solid ${({ theme }) => theme.color.text};
  color: ${({ theme }) => theme.color.text};
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-decoration: none;

  &:hover,
  &:focus-visible {
    background: ${({ theme }) => theme.color.text};
    color: ${({ theme }) => theme.color.neutral[100]};
  }
`

export default function NaoEncontrada() {
  return (
    <Shell>
      <Card>
        <Kicker>Erro 404</Kicker>
        <Codigo>404</Codigo>
        <h1>Página não encontrada</h1>
        <Note>O endereço que você abriu não existe ou foi movido.</Note>
        <Voltar to="/">Voltar para a home</Voltar>
      </Card>
    </Shell>
  )
}
