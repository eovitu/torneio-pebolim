/**
 * Porta de entrada do app.
 *
 * Quem já tem sessão nunca vê esta tela: vai direto para a área logada.
 *
 * "Entrar como visitante" não cria sessão anônima — não existe esse conceito
 * aqui. O visitante simplesmente navega sem conta, e é a RLS que garante o que
 * ele enxerga: leitura do conteúdo público e nada além disso (§40).
 */

import { Navigate } from 'react-router-dom'
import styled from 'styled-components'
import { Eye, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { Acoes, BotaoLink } from '../ui/Botao'
import { Carregando } from '../ui/Estados'
import { Texto } from '../ui/Superficie'
import { midia } from '../design-system/tokens'

const Palco = styled.main`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.space[6]} ${({ theme }) => theme.space[5]};
  color: ${({ theme }) => theme.color.onDark};
  background: linear-gradient(
    150deg,
    ${({ theme }) => theme.color.campo[900]} 0%,
    ${({ theme }) => theme.color.campo[700]} 55%,
    ${({ theme }) => theme.color.campo[600]} 100%
  );
  position: relative;
  overflow: hidden;

  /* As barras da mesa, sugeridas em CSS puro — zero asset, zero requisição. */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.045) 0 2px,
      transparent 2px 64px
    );
  }
`

const Conteudo = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[5]};
  animation: pb-surgir ${({ theme }) => theme.motion.lento} ${({ theme }) => theme.motion.entrada}
    both;

  h1 {
    font-size: 40px;
    line-height: 1;
    letter-spacing: -0.04em;
  }

  ${midia.md} {
    h1 {
      font-size: 56px;
    }
  }
`

const Marca = styled.p`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.micro};
  font-weight: 800;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.bola[300]};
`

const Bolinha = styled.span`
  width: 10px;
  height: 10px;
  border-radius: ${({ theme }) => theme.radius.circle};
  background: ${({ theme }) => theme.color.accent};
`

export default function BemVindo() {
  const { session, carregando } = useAuth()

  if (carregando) {
    return (
      <Palco>
        <Conteudo>
          <Carregando linhas={2} />
        </Conteudo>
      </Palco>
    )
  }

  if (session !== null) return <Navigate to="/home" replace />

  return (
    <Palco>
      <Conteudo>
        <Marca>
          <Bolinha aria-hidden="true" />
          Torneio Pebolim
        </Marca>

        <h1>
          O campeonato
          <br />
          na palma da mão.
        </h1>

        <Texto $claro>
          Placar ao vivo, classificação, artilharia e o histórico de cada jogador. Entre para
          disputar — ou só acompanhe, sem conta nenhuma.
        </Texto>

        <Acoes>
          <BotaoLink to="/login" $variante="primario" $tamanho="lg" $bloco>
            <LogIn size={18} aria-hidden="true" />
            Entrar
          </BotaoLink>
          <BotaoLink to="/register" $variante="claro" $tamanho="lg" $bloco>
            <UserPlus size={18} aria-hidden="true" />
            Criar conta
          </BotaoLink>
        </Acoes>

        <BotaoLink to="/home" $variante="fantasma" style={{ color: 'rgba(255,255,255,.75)' }}>
          <Eye size={16} aria-hidden="true" />
          Acompanhar sem entrar
        </BotaoLink>
      </Conteudo>
    </Palco>
  )
}
