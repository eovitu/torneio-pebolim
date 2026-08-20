/**
 * Cartões do domínio: partida, torneio, time e jogador.
 *
 * Ficam juntos de propósito — são as quatro peças que se repetem na Home, nas
 * listas e nas páginas de detalhe. Uma alteração de linguagem visual acontece
 * aqui uma vez, e não em oito telas.
 *
 * Nenhum deles calcula regra: recebem o que o domínio já derivou (§18 do
 * redesign).
 */

import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { ChevronRight, Radio, Trophy, Users } from 'lucide-react'
import type { LinhaEquipe, LinhaJogador, LinhaPartida, LinhaTorneio } from '../dados/campeonato'
import { ROTULO_STATUS_PARTIDA, ROTULO_STATUS_TORNEIO, estaAoVivo } from '../dados/campeonato'
import { Avatar, Badge, PilhaAvatares, PontoAoVivo } from '../ui/Etiqueta'
import { Rotulo, Texto, } from '../ui/Superficie'
import { cartaoInterativo } from '../ui/estilos'
import { tomDoStatusDaPartida, tomDoStatusDoTorneio } from './tons'

/* -------------------------------------------------------------------------- */
/* Partida                                                                    */
/* -------------------------------------------------------------------------- */

const CartaoPartida = styled(Link)<{ $aoVivo?: boolean }>`
  display: block;
  text-decoration: none;
  color: inherit;
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid
    ${({ theme, $aoVivo }) => ($aoVivo === true ? theme.color.aoVivo : theme.color.borderSoft)};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme }) => theme.space[4]};
  box-shadow: ${({ theme }) => theme.shadow.xs};
  ${cartaoInterativo}
`

const TopoPartida = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
  margin-bottom: ${({ theme }) => theme.space[3]};
`

const Confronto = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
`

const LadoConfronto = styled.div<{ $direita?: boolean }>`
  min-width: 0;
  text-align: ${({ $direita }) => ($direita === true ? 'right' : 'left')};

  strong {
    display: block;
    font-size: ${({ theme }) => theme.fontSize.small};
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const PlacarConfronto = styled.div<{ $decidido?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.font.numero};
  font-weight: 800;
  font-size: ${({ theme }) => theme.fontSize.h3};
  font-variant-numeric: tabular-nums;
  line-height: 1;
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[3]};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme, $decidido }) =>
    $decidido === true ? theme.color.campo[50] : theme.color.surfaceSunken};

  span:nth-child(2) {
    font-size: ${({ theme }) => theme.fontSize.caption};
    color: ${({ theme }) => theme.color.muted};
  }
`

const HoraPartida = styled.span`
  font-family: ${({ theme }) => theme.font.numero};
  font-size: ${({ theme }) => theme.fontSize.small};
  font-weight: 700;
  color: ${({ theme }) => theme.color.muted};
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[3]};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surfaceSunken};
`

export interface PropsCartaoPartida {
  partida: LinhaPartida
  nomeA: string
  nomeB: string
  placarA: number
  placarB: number
  contexto?: string
}

export function CartaoDePartida({
  partida,
  nomeA,
  nomeB,
  placarA,
  placarB,
  contexto,
}: PropsCartaoPartida) {
  const vivo = estaAoVivo(partida)
  const agendada = partida.status === 'SCHEDULED'
  const hora =
    partida.agendada_para === null
      ? null
      : new Date(partida.agendada_para).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })

  return (
    <CartaoPartida to={`/matches/${partida.id}`} $aoVivo={vivo}>
      <TopoPartida>
        <Rotulo>{contexto ?? partida.label}</Rotulo>
        <Badge $tom={tomDoStatusDaPartida(partida.status)}>
          {vivo && partida.status !== 'PAUSED' && <PontoAoVivo />}
          {ROTULO_STATUS_PARTIDA[partida.status]}
        </Badge>
      </TopoPartida>

      <Confronto>
        <LadoConfronto>
          <strong>{nomeA}</strong>
        </LadoConfronto>

        {agendada ? (
          <HoraPartida>{hora ?? 'a definir'}</HoraPartida>
        ) : (
          <PlacarConfronto $decidido={partida.status === 'FINISHED'}>
            <span>{placarA}</span>
            <span>×</span>
            <span>{placarB}</span>
          </PlacarConfronto>
        )}

        <LadoConfronto $direita>
          <strong>{nomeB}</strong>
        </LadoConfronto>
      </Confronto>
    </CartaoPartida>
  )
}

/* -------------------------------------------------------------------------- */
/* Partida ao vivo em destaque (Home)                                         */
/* -------------------------------------------------------------------------- */

const Destaque = styled(Link)`
  display: block;
  text-decoration: none;
  color: ${({ theme }) => theme.color.onDark};
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: ${({ theme }) => theme.space[5]};
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.color.campo[900]} 0%,
    ${({ theme }) => theme.color.campo[700]} 60%,
    ${({ theme }) => theme.color.campo[600]} 100%
  );
  box-shadow: ${({ theme }) => theme.shadow.md};
  position: relative;
  overflow: hidden;
  ${cartaoInterativo}

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 2px;
    height: 140%;
    transform: translate(-50%, -50%);
    background: rgba(255, 255, 255, 0.12);
  }
`

const TopoDestaque = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
  margin-bottom: ${({ theme }) => theme.space[4]};
`

const CorpoDestaque = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  text-align: center;
`

const NumeroGrande = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.font.numero};
  font-weight: 800;
  font-size: ${({ theme }) => theme.fontSize.display};
  font-variant-numeric: tabular-nums;
  line-height: 1;
`

const NomeDestaque = styled.p`
  margin: 0 0 ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.fontSize.small};
  font-weight: 700;
  overflow-wrap: anywhere;
`

export function DestaqueAoVivo({
  partida,
  nomeA,
  nomeB,
  placarA,
  placarB,
  contexto,
}: PropsCartaoPartida) {
  return (
    <Destaque to={`/matches/${partida.id}`}>
      <TopoDestaque>
        <Badge $tom="aoVivo">
          <PontoAoVivo />
          {ROTULO_STATUS_PARTIDA[partida.status]}
        </Badge>
        <Badge $tom="claro">
          <Radio size={12} aria-hidden="true" />
          {contexto ?? partida.label}
        </Badge>
      </TopoDestaque>

      <CorpoDestaque>
        <div>
          <NomeDestaque>{nomeA}</NomeDestaque>
          <NumeroGrande>{placarA}</NumeroGrande>
        </div>
        <Texto $claro>×</Texto>
        <div>
          <NomeDestaque>{nomeB}</NomeDestaque>
          <NumeroGrande>{placarB}</NumeroGrande>
        </div>
      </CorpoDestaque>
    </Destaque>
  )
}

/* -------------------------------------------------------------------------- */
/* Torneio                                                                    */
/* -------------------------------------------------------------------------- */

const CartaoTorneio = styled.article`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme }) => theme.space[5]};
  box-shadow: ${({ theme }) => theme.shadow.xs};
  ${cartaoInterativo}

  h3 {
    font-size: ${({ theme }) => theme.fontSize.h4};
    overflow-wrap: anywhere;
  }
`

const Numeros = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[5]};
  margin: 0;

  div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  dt {
    font-size: ${({ theme }) => theme.fontSize.micro};
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.muted};
    order: 2;
  }

  dd {
    margin: 0;
    font-family: ${({ theme }) => theme.font.numero};
    font-size: ${({ theme }) => theme.fontSize.h3};
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    order: 1;
  }
`

const LinhaTopoTorneio = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
`

export function CartaoDeTorneio({
  torneio,
  equipes,
  participantes,
  aoVivo = 0,
  acao,
}: {
  torneio: LinhaTorneio
  equipes: number
  participantes: number
  aoVivo?: number
  acao?: React.ReactNode
}) {
  return (
    <CartaoTorneio>
      <LinhaTopoTorneio>
        <div>
          <Rotulo $cor="marca">
            <Trophy size={11} aria-hidden="true" style={{ verticalAlign: '-1px' }} /> Torneio
          </Rotulo>
          <h3>{torneio.nome}</h3>
        </div>
        <Badge $tom={tomDoStatusDoTorneio(torneio.status)}>
          {ROTULO_STATUS_TORNEIO[torneio.status]}
        </Badge>
      </LinhaTopoTorneio>

      {aoVivo > 0 && (
        <Badge $tom="aoVivo" style={{ alignSelf: 'flex-start' }}>
          <PontoAoVivo />
          {aoVivo === 1 ? '1 partida ao vivo' : `${aoVivo} partidas ao vivo`}
        </Badge>
      )}

      <Numeros>
        <div>
          <dt>Participantes</dt>
          <dd>{participantes}</dd>
        </div>
        <div>
          <dt>Equipes</dt>
          <dd>{equipes}</dd>
        </div>
      </Numeros>

      {acao}
    </CartaoTorneio>
  )
}

/* -------------------------------------------------------------------------- */
/* Time                                                                       */
/* -------------------------------------------------------------------------- */

const CartaoTime = styled(Link)<{ $cor?: string | null }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[4]};
  text-decoration: none;
  color: inherit;
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  border-left: 5px solid ${({ theme, $cor }) => $cor ?? theme.color.campo[500]};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme }) => theme.space[4]};
  box-shadow: ${({ theme }) => theme.shadow.xs};
  ${cartaoInterativo}

  h3 {
    font-size: ${({ theme }) => theme.fontSize.h4};
    overflow-wrap: anywhere;
  }
`

const Escudo = styled.div<{ $cor?: string | null }>`
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  min-width: 52px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $cor }) => $cor ?? theme.color.campo[600]};
  color: #fff;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const CorpoTime = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
`

export function CartaoDeTime({
  equipe,
  integrantes,
  legenda,
  para,
}: {
  equipe: LinhaEquipe
  integrantes: LinhaJogador[]
  legenda?: string
  para: string
}) {
  return (
    <CartaoTime to={para} $cor={equipe.cor_primaria}>
      <Escudo $cor={equipe.cor_primaria} aria-hidden="true">
        {equipe.logo_url !== null && equipe.logo_url !== '' ? (
          <img src={equipe.logo_url} alt="" loading="lazy" />
        ) : (
          <Users size={24} />
        )}
      </Escudo>

      <CorpoTime>
        {legenda !== undefined && <Rotulo>{legenda}</Rotulo>}
        <h3>{equipe.nome}</h3>
        <PilhaAvatares>
          {integrantes.slice(0, 5).map((j) => (
            <Avatar key={j.id} nome={j.nome} url={j.foto_url} tamanho="xs" />
          ))}
        </PilhaAvatares>
      </CorpoTime>

      <ChevronRight size={20} aria-hidden="true" />
    </CartaoTime>
  )
}

/* -------------------------------------------------------------------------- */
/* Jogador                                                                    */
/* -------------------------------------------------------------------------- */

const LinhaJogadorLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  min-height: 56px;
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  border-radius: ${({ theme }) => theme.radius.sm};
  text-decoration: none;
  color: inherit;
  transition: background ${({ theme }) => theme.motion.rapido} ease;

  &:hover {
    background: ${({ theme }) => theme.color.surfaceSunken};
  }

  strong {
    flex: 1;
    min-width: 0;
    font-size: ${({ theme }) => theme.fontSize.small};
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

/**
 * Linha clicável de jogador. Existe para que qualquer nome, em qualquer lista,
 * leve ao perfil público dele — é essa a sensação de rede social que o produto
 * quer (§11 do redesign).
 */
export function LinhaDeJogador({
  jogador,
  detalhe,
  direita,
}: {
  jogador: LinhaJogador
  detalhe?: string
  direita?: React.ReactNode
}) {
  return (
    <LinhaJogadorLink to={`/players/${jogador.id}`}>
      <Avatar nome={jogador.nome} url={jogador.foto_url} tamanho="sm" />
      <strong>
        {jogador.nome}
        {detalhe !== undefined && (
          <Texto as="span" $pequeno $mudo>
            {' · '}
            {detalhe}
          </Texto>
        )}
      </strong>
      {direita}
    </LinhaJogadorLink>
  )
}

/* -------------------------------------------------------------------------- */
/* Número solto com rótulo                                                    */
/* -------------------------------------------------------------------------- */

const Estatistica = styled.div<{ $destaque?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${({ theme }) => theme.space[3]};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme, $destaque }) =>
    $destaque === true ? theme.color.bola[50] : theme.color.surfaceAlt};
  border: 1px solid
    ${({ theme, $destaque }) => ($destaque === true ? theme.color.bola[200] : theme.color.borderSoft)};
  text-align: center;

  span:first-child {
    font-family: ${({ theme }) => theme.font.numero};
    font-size: ${({ theme }) => theme.fontSize.h3};
    font-weight: 800;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    color: ${({ theme, $destaque }) => ($destaque === true ? theme.color.bola[700] : theme.color.text)};
  }

  span:last-child {
    font-size: ${({ theme }) => theme.fontSize.micro};
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.muted};
  }
`

export function Numero({
  valor,
  rotulo,
  destaque,
}: {
  valor: number | string
  rotulo: string
  destaque?: boolean
}) {
  return (
    <Estatistica $destaque={destaque}>
      <span>{valor}</span>
      <span>{rotulo}</span>
    </Estatistica>
  )
}

/** Grade de números — 3 colunas no celular, mais no desktop. */
export const GradeDeNumeros = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.space[2]};

  @media (min-width: ${({ theme }) => theme.breakpoint.md}) {
    grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  }
`
