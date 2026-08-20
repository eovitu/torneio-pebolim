/**
 * Porta de entrada do app.
 *
 * Quem já tem sessão nunca vê esta tela: vai direto para a área logada.
 *
 * "Entrar como visitante" não cria sessão anônima — não existe esse conceito
 * aqui. O visitante simplesmente navega sem conta, e é a RLS que garante o que
 * ele enxerga: leitura do conteúdo público e nada além disso (§40).
 */

import { Link, Navigate } from 'react-router-dom'
import styled from 'styled-components'
import { Card, Kicker, Note, Shell } from '../components/Shell'
import { useAuth } from '../auth/useAuth'

const Acoes = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};
  margin-top: ${({ theme }) => theme.space[6]};
`

/** Botão principal em forma de link — alvo grande, para o dedo (§43). */
const BotaoLink = styled(Link)`
  display: block;
  text-align: center;
  text-decoration: none;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  min-height: 56px;
  padding: ${({ theme }) => theme.space[4]};
  border: 2px solid ${({ theme }) => theme.color.text};
  background: ${({ theme }) => theme.color.text};
  color: ${({ theme }) => theme.color.neutral[100]};

  &:hover,
  &:focus-visible {
    background: ${({ theme }) => theme.color.accent};
    border-color: ${({ theme }) => theme.color.accent};
    color: ${({ theme }) => theme.color.neutral[100]};
  }
`

const BotaoLinkSecundario = styled(BotaoLink)`
  background: transparent;
  color: ${({ theme }) => theme.color.text};
`

const Visitante = styled.div`
  margin-top: ${({ theme }) => theme.space[4]};
  text-align: center;

  a {
    font-size: 13px;
    font-weight: 600;
  }
`

export default function BemVindo() {
  const { session, carregando } = useAuth()

  if (carregando) {
    return (
      <Shell>
        <Card>
          <Note>Carregando…</Note>
        </Card>
      </Shell>
    )
  }

  if (session !== null) return <Navigate to="/home" replace />

  return (
    <Shell>
      <Card>
        <Kicker>Pebolim · Torneio</Kicker>
        <h1>Bem-vindo ao Torneio Pebolim</h1>
        <Note>Acompanhe as partidas ao vivo, a classificação e a artilharia.</Note>

        <Acoes>
          <BotaoLink to="/login">Entrar</BotaoLink>
          <BotaoLinkSecundario to="/register">Cadastrar-se</BotaoLinkSecundario>
        </Acoes>

        <Visitante>
          <Link to="/home">Entrar como visitante</Link>
        </Visitante>
      </Card>
    </Shell>
  )
}
