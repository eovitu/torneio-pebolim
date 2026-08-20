/**
 * Navegação persistente das telas internas.
 *
 * Até aqui só existiam links soltos no fim de cada tela, e dava para se perder
 * dentro do app. Esta barra fica sempre no topo, marca onde a pessoa está e
 * mostra apenas o que ela pode acessar — os itens de administração não
 * aparecem para quem não é admin.
 *
 * Como sempre: esconder item é conveniência de interface. Quem barra o acesso
 * de fato é a RLS e as funções do banco (§45).
 */

import { NavLink, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { useAuth } from '../auth/useAuth'
import { usePapeis } from '../auth/usePapeis'

const Barra = styled.header`
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  flex-wrap: wrap;
  padding: ${({ theme }) => theme.space[3]} ${({ theme }) => theme.space[4]};
  border-bottom: 2px solid ${({ theme }) => theme.color.text};
  background: ${({ theme }) => theme.color.bg};
`

const Marca = styled(NavLink)`
  font-family: ${({ theme }) => theme.font.heading};
  font-weight: ${({ theme }) => theme.font.headingWeight};
  font-size: 13px;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  text-decoration: none;
  color: ${({ theme }) => theme.color.text};
  margin-right: auto;
`

const Item = styled(NavLink)`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
  padding: ${({ theme }) => theme.space[2]} 0;
  color: ${({ theme }) => theme.color.muted};
  border-bottom: 2px solid transparent;

  &.active {
    color: ${({ theme }) => theme.color.text};
    border-bottom-color: ${({ theme }) => theme.color.accent};
  }

  &:hover {
    color: ${({ theme }) => theme.color.text};
  }
`

const Sair = styled.button`
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.color.accent};
  cursor: pointer;
`

export function Navegacao() {
  const { session, sair } = useAuth()
  const { ehAdmin } = usePapeis()
  const navigate = useNavigate()

  return (
    <Barra>
      <Marca to={session === null ? '/' : '/home'}>Pebolim</Marca>

      <Item to="/home">Início</Item>
      {session !== null && <Item to="/profile">Perfil</Item>}
      {ehAdmin && (
        <>
          <Item to="/admin/tournaments">Torneios</Item>
          <Item to="/admin/users">Contas</Item>
        </>
      )}

      {session === null ? (
        <Item to="/login">Entrar</Item>
      ) : (
        <Sair
          type="button"
          onClick={() =>
            void sair().then(() => {
              navigate('/', { replace: true })
            })
          }
        >
          Sair
        </Sair>
      )}
    </Barra>
  )
}
