/**
 * Moldura das telas de foco único (entrar, cadastrar, 404).
 *
 * Mantida com os mesmos nomes de antes para não obrigar uma reescrita das
 * telas de autenticação; o que mudou foi só a linguagem visual, que agora vem
 * dos tokens novos.
 */

import styled from 'styled-components'

export const Shell = styled.main`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.space[5]};
  padding-bottom: calc(${({ theme }) => theme.layout.barraMobile} + ${({ theme }) => theme.space[6]});
`

export const Card = styled.section`
  width: 100%;
  max-width: ${({ theme }) => theme.layout.appMaxWidth};
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.sm};
  padding: ${({ theme }) => theme.space[6]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
  animation: pb-surgir ${({ theme }) => theme.motion.lento} ${({ theme }) => theme.motion.entrada}
    both;
`

export const Kicker = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.micro};
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.accent};
`

export const Note = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.small};
  color: ${({ theme }) => theme.color.muted};
`
