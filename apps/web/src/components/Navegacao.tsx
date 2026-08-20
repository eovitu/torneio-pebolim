/**
 * Navegação persistente do app.
 *
 * Dois layouts propositais, não um espremido no outro (§5 do redesign):
 * no celular, uma barra inferior fixa ao alcance do polegar; no desktop, uma
 * barra superior com os mesmos destinos e a identidade à esquerda.
 *
 * Os itens são os mesmos nos dois: Início · Torneios · Times · Partidas ·
 * Perfil, mais Admin para quem é administrador. Esconder o item de admin é
 * conveniência de interface — quem barra o acesso de fato é a RLS e o
 * `is_admin()` dentro de cada função do banco (§45).
 */

import { NavLink, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { CalendarDays, Home, LogIn, LogOut, Shield, Trophy, User, Users } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { usePapeis } from '../auth/usePapeis'
import { midia } from '../design-system/tokens'
import { Botao, BotaoLink } from '../ui/Botao'

const DESTINOS = [
  { para: '/home', rotulo: 'Início', Icone: Home },
  { para: '/tournaments', rotulo: 'Torneios', Icone: Trophy },
  { para: '/teams', rotulo: 'Times', Icone: Users },
  { para: '/matches', rotulo: 'Partidas', Icone: CalendarDays },
] as const

/* -------------------------------------------------------------------------- */
/* Barra superior                                                             */
/* -------------------------------------------------------------------------- */

const Topo = styled.header`
  position: sticky;
  top: 0;
  z-index: ${({ theme }) => theme.zIndex.barra};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[4]};
  height: ${({ theme }) => theme.layout.barraTopo};
  padding: 0 ${({ theme }) => theme.space[4]};
  background: ${({ theme }) => theme.color.campo[800]};
  color: ${({ theme }) => theme.color.onDark};

  ${midia.md} {
    padding: 0 ${({ theme }) => theme.space[6]};
    gap: ${({ theme }) => theme.space[6]};
  }
`

const Marca = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.font.heading};
  font-weight: ${({ theme }) => theme.font.headingWeight};
  font-size: ${({ theme }) => theme.fontSize.h4};
  letter-spacing: -0.03em;
  text-decoration: none;
  color: ${({ theme }) => theme.color.onDark};
  margin-right: auto;
  white-space: nowrap;
`

/** A "bola" da marca: um ponto laranja, sem custo de asset. */
const Bolinha = styled.span`
  width: 12px;
  height: 12px;
  border-radius: ${({ theme }) => theme.radius.circle};
  background: ${({ theme }) => theme.color.accent};
  box-shadow: 0 0 0 3px rgba(242, 98, 15, 0.25);
`

const ItensTopo = styled.nav`
  display: none;

  ${midia.md} {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space[1]};
  }
`

const ItemTopo = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  height: 40px;
  padding: 0 ${({ theme }) => theme.space[4]};
  border-radius: ${({ theme }) => theme.radius.pill};
  font-size: ${({ theme }) => theme.fontSize.small};
  font-weight: 700;
  text-decoration: none;
  color: ${({ theme }) => theme.color.onDarkMuted};
  transition: background ${({ theme }) => theme.motion.rapido} ease,
    color ${({ theme }) => theme.motion.rapido} ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: ${({ theme }) => theme.color.onDark};
  }

  &.active {
    background: rgba(255, 255, 255, 0.16);
    color: ${({ theme }) => theme.color.onDark};
  }
`

const ItemAdmin = styled(ItemTopo)`
  color: ${({ theme }) => theme.color.bola[200]};

  &.active {
    background: ${({ theme }) => theme.color.accent};
    color: ${({ theme }) => theme.color.onDark};
  }
`

const AcoesTopo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`

/* -------------------------------------------------------------------------- */
/* Barra inferior (celular)                                                   */
/* -------------------------------------------------------------------------- */

const Inferior = styled.nav`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: ${({ theme }) => theme.zIndex.barra};
  display: flex;
  align-items: stretch;
  height: calc(${({ theme }) => theme.layout.barraMobile} + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: ${({ theme }) => theme.color.surface};
  border-top: 1px solid ${({ theme }) => theme.color.borderSoft};
  box-shadow: ${({ theme }) => theme.shadow.barra};

  ${midia.md} {
    display: none;
  }
`

const ItemInferior = styled(NavLink)`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 0;
  text-decoration: none;
  font-size: ${({ theme }) => theme.fontSize.micro};
  font-weight: 700;
  letter-spacing: 0.02em;
  color: ${({ theme }) => theme.color.muted};
  transition: color ${({ theme }) => theme.motion.rapido} ease;
  -webkit-tap-highlight-color: transparent;

  svg {
    transition: transform ${({ theme }) => theme.motion.normal}
      ${({ theme }) => theme.motion.entrada};
  }

  &.active {
    color: ${({ theme }) => theme.color.accent};
  }

  &.active svg {
    transform: translateY(-2px) scale(1.08);
  }

  &:active svg {
    transform: scale(0.92);
  }
`

export function Navegacao() {
  const { session, sair } = useAuth()
  const { ehAdmin } = usePapeis()
  const navigate = useNavigate()

  const logado = session !== null

  const sairEIrParaInicio = () =>
    void sair().then(() => {
      navigate('/', { replace: true })
    })

  return (
    <>
      <Topo>
        <Marca to={logado ? '/home' : '/'}>
          <Bolinha aria-hidden="true" />
          Pebolim
        </Marca>

        <ItensTopo aria-label="Navegação principal">
          {DESTINOS.map(({ para, rotulo, Icone }) => (
            <ItemTopo key={para} to={para}>
              <Icone size={16} aria-hidden="true" />
              {rotulo}
            </ItemTopo>
          ))}
          {logado && (
            <ItemTopo to="/profile">
              <User size={16} aria-hidden="true" />
              Perfil
            </ItemTopo>
          )}
          {ehAdmin && (
            <ItemAdmin to="/admin">
              <Shield size={16} aria-hidden="true" />
              Admin
            </ItemAdmin>
          )}
        </ItensTopo>

        <AcoesTopo>
          {logado ? (
            <Botao type="button" $variante="claro" $tamanho="sm" onClick={sairEIrParaInicio}>
              <LogOut size={15} aria-hidden="true" />
              Sair
            </Botao>
          ) : (
            <BotaoLink to="/login" $variante="primario" $tamanho="sm">
              <LogIn size={15} aria-hidden="true" />
              Entrar
            </BotaoLink>
          )}
        </AcoesTopo>
      </Topo>

      <Inferior aria-label="Navegação principal">
        {DESTINOS.map(({ para, rotulo, Icone }) => (
          <ItemInferior key={para} to={para}>
            <Icone size={21} aria-hidden="true" />
            {rotulo}
          </ItemInferior>
        ))}
        <ItemInferior to={logado ? '/profile' : '/login'}>
          <User size={21} aria-hidden="true" />
          {logado ? 'Perfil' : 'Entrar'}
        </ItemInferior>
        {ehAdmin && (
          <ItemInferior to="/admin">
            <Shield size={21} aria-hidden="true" />
            Admin
          </ItemInferior>
        )}
      </Inferior>
    </>
  )
}
