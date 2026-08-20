/**
 * Peças visuais das telas de administração e a guarda de rota.
 *
 * A guarda esconde a tela de quem não é administrador — conveniência de
 * interface. Quem realmente barra a ação é a RLS e o `is_admin()` dentro de
 * cada função do banco (§45).
 */

import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import styled from 'styled-components'
import { useAuth } from '../auth/useAuth'
import { usePapeis } from '../auth/usePapeis'
import { Card, Kicker, Note, Shell } from './Shell'

export const Painel = styled.main`
  min-height: 100dvh;
  width: 100%;
  max-width: ${({ theme }) => theme.layout.contentMaxWidth};
  margin: 0 auto;
  padding: ${({ theme }) => theme.space[4]};
`

export const Secao = styled.section`
  border: 2px solid ${({ theme }) => theme.color.divider};
  background: ${({ theme }) => theme.color.neutral[100]};
  padding: ${({ theme }) => theme.space[4]};

  & + & {
    margin-top: ${({ theme }) => theme.space[4]};
  }

  h2 {
    margin: 0 0 ${({ theme }) => theme.space[3]};
    font-size: 15px;
  }
`

export const Linha = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[3]};
  align-items: flex-end;
`

export const Itens = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};

  li {
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.space[2]};
    align-items: baseline;
    justify-content: space-between;
    border-bottom: 1px solid ${({ theme }) => theme.color.divider};
    padding-bottom: ${({ theme }) => theme.space[2]};
    font-size: 14px;
  }
`

export const Etiqueta = styled.span`
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.muted};
`

/** Só renderiza o conteúdo para administradores. */
export function RotaAdmin({ children }: { children: ReactNode }) {
  const { session, carregando: carregandoSessao } = useAuth()
  const { ehAdmin, carregando: carregandoPapeis } = usePapeis()

  if (carregandoSessao || carregandoPapeis) {
    return (
      <Shell>
        <Card>
          <Note>Verificando permissões…</Note>
        </Card>
      </Shell>
    )
  }

  if (session === null) return <Navigate to="/entrar" replace />

  if (!ehAdmin) {
    return (
      <Shell>
        <Card>
          <Kicker>Acesso restrito</Kicker>
          <h1>Área administrativa</h1>
          <Note>Sua conta não tem permissão de administrador.</Note>
          <Note>
            <Link to="/">Voltar para a home</Link>
          </Note>
        </Card>
      </Shell>
    )
  }

  return <>{children}</>
}
