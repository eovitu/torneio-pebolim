/**
 * Classificação e artilharia.
 *
 * As duas mudam de forma conforme a tela (§16 do redesign): no desktop, tabela
 * colunar completa; no celular, cartão por linha, porque dez colunas espremidas
 * em 360px não se leem.
 *
 * Nenhum número é calculado aqui — `StandingsRow` e `ScorerRow` chegam prontos
 * do domínio. O que esta camada faz é só decidir o que mostrar e como.
 *
 * Empate sem critério seguinte aparece marcado, nunca disfarçado por uma
 * ordenação alfabética apresentada como se fosse critério esportivo (§55).
 */

import { Link } from 'react-router-dom'
import styled from 'styled-components'
import type { ScorerRow, StandingsRow } from '@pebolim/domain'
import { Avatar, Badge } from '../ui/Etiqueta'
import { RolagemHorizontal, Texto } from '../ui/Superficie'
import { midia } from '../design-system/tokens'
import type { LinhaJogador } from '../dados/campeonato'

/* -------------------------------------------------------------------------- */
/* Classificação                                                              */
/* -------------------------------------------------------------------------- */

const Tabela = styled.table`
  display: none;
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSize.small};

  ${midia.md} {
    display: table;
  }

  th,
  td {
    padding: ${({ theme }) => theme.space[3]};
    text-align: right;
    white-space: nowrap;
  }

  th:nth-child(1),
  td:nth-child(1),
  th:nth-child(2),
  td:nth-child(2) {
    text-align: left;
  }

  thead th {
    font-size: ${({ theme }) => theme.fontSize.micro};
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.muted};
    border-bottom: 2px solid ${({ theme }) => theme.color.border};
  }

  tbody tr {
    border-bottom: 1px solid ${({ theme }) => theme.color.borderSoft};
    transition: background ${({ theme }) => theme.motion.rapido} ease;
  }

  tbody tr:hover {
    background: ${({ theme }) => theme.color.surfaceAlt};
  }

  td[data-numero] {
    font-family: ${({ theme }) => theme.font.numero};
    font-variant-numeric: tabular-nums;
  }

  td[data-pontos] {
    font-weight: 800;
    color: ${({ theme }) => theme.color.campo[700]};
  }
`

const Posicao = styled.span<{ $topo?: boolean }>`
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: ${({ theme }) => theme.radius.xs};
  font-family: ${({ theme }) => theme.font.numero};
  font-weight: 800;
  font-size: ${({ theme }) => theme.fontSize.caption};
  background: ${({ theme, $topo }) =>
    $topo === true ? theme.color.campo[600] : theme.color.surfaceSunken};
  color: ${({ theme, $topo }) => ($topo === true ? '#fff' : theme.color.textSoft)};
`

const ListaCompacta = styled.ol`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  list-style: none;
  margin: 0;
  padding: 0;

  ${midia.md} {
    display: none;
  }
`

const LinhaCompacta = styled.li`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[3]};
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surface};

  strong {
    font-size: ${({ theme }) => theme.fontSize.small};
    overflow-wrap: anywhere;
  }
`

const MiniNumeros = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.fontSize.caption};
  color: ${({ theme }) => theme.color.muted};
  font-variant-numeric: tabular-nums;
`

const Pontos = styled.div`
  text-align: center;

  span:first-child {
    display: block;
    font-family: ${({ theme }) => theme.font.numero};
    font-size: ${({ theme }) => theme.fontSize.h3};
    font-weight: 800;
    line-height: 1;
    color: ${({ theme }) => theme.color.campo[700]};
  }

  span:last-child {
    font-size: ${({ theme }) => theme.fontSize.micro};
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.muted};
  }
`

export function Classificacao({ linhas }: { linhas: StandingsRow[] }) {
  const temEmpateSemCriterio = linhas.some((l) => l.unresolvedTie)

  return (
    <div>
      <RolagemHorizontal>
        <Tabela>
          <thead>
            <tr>
              <th scope="col">Pos</th>
              <th scope="col">Time</th>
              <th scope="col">Pts</th>
              <th scope="col">J</th>
              <th scope="col">V</th>
              <th scope="col">E</th>
              <th scope="col">D</th>
              <th scope="col">GF</th>
              <th scope="col">GC</th>
              <th scope="col">SG</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.teamId}>
                <td>
                  <Posicao $topo={l.position === 1}>{l.position}</Posicao>
                </td>
                <td>
                  <strong>{l.teamName}</strong>
                  {l.unresolvedTie && (
                    <>
                      {' '}
                      <Badge $tom="aviso">empate</Badge>
                    </>
                  )}
                </td>
                <td data-numero data-pontos>
                  {l.pts}
                </td>
                <td data-numero>{l.j}</td>
                <td data-numero>{l.v}</td>
                <td data-numero>{l.e}</td>
                <td data-numero>{l.d}</td>
                <td data-numero>{l.gf}</td>
                <td data-numero>{l.gc}</td>
                <td data-numero>
                  {l.saldo > 0 ? '+' : ''}
                  {l.saldo}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </RolagemHorizontal>

      <ListaCompacta>
        {linhas.map((l) => (
          <LinhaCompacta key={l.teamId}>
            <Posicao $topo={l.position === 1}>{l.position}</Posicao>
            <div>
              <strong>{l.teamName}</strong>
              <MiniNumeros>
                <span>{l.j} J</span>
                <span>
                  {l.v}V {l.e}E {l.d}D
                </span>
                <span>
                  SG {l.saldo > 0 ? '+' : ''}
                  {l.saldo}
                </span>
              </MiniNumeros>
              {l.unresolvedTie && <Badge $tom="aviso">empate sem critério</Badge>}
            </div>
            <Pontos>
              <span>{l.pts}</span>
              <span>pts</span>
            </Pontos>
          </LinhaCompacta>
        ))}
      </ListaCompacta>

      {temEmpateSemCriterio && (
        <Texto $pequeno $mudo style={{ marginTop: 12 }}>
          As equipes marcadas estão empatadas em pontos e saldo. As regras oficiais não definem um
          terceiro critério — a ordem exibida é apenas técnica e não decide nada.
        </Texto>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Artilharia                                                                 */
/* -------------------------------------------------------------------------- */

const ListaArtilharia = styled.ol`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  list-style: none;
  margin: 0;
  padding: 0;
`

const Artilheiro = styled.li<{ $lider?: boolean }>`
  a {
    display: grid;
    grid-template-columns: 34px auto 1fr auto;
    align-items: center;
    gap: ${({ theme }) => theme.space[3]};
    padding: ${({ theme }) => theme.space[3]};
    border-radius: ${({ theme }) => theme.radius.sm};
    text-decoration: none;
    color: inherit;
    border: 1px solid
      ${({ theme, $lider }) => ($lider === true ? theme.color.ouro : theme.color.borderSoft)};
    background: ${({ theme, $lider }) =>
      $lider === true ? theme.color.ouroSuave : theme.color.surface};
    transition: background ${({ theme }) => theme.motion.rapido} ease;
  }

  a:hover {
    background: ${({ theme, $lider }) =>
      $lider === true ? theme.color.ouroSuave : theme.color.surfaceAlt};
  }
`

const Medalha = styled.span`
  font-family: ${({ theme }) => theme.font.numero};
  font-size: ${({ theme }) => theme.fontSize.body};
  font-weight: 800;
  text-align: center;
`

const NomeArtilheiro = styled.div`
  min-width: 0;

  strong {
    display: block;
    font-size: ${({ theme }) => theme.fontSize.small};
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: ${({ theme }) => theme.fontSize.micro};
    color: ${({ theme }) => theme.color.muted};
  }
`

const Gols = styled.div`
  text-align: right;

  strong {
    display: block;
    font-family: ${({ theme }) => theme.font.numero};
    font-size: ${({ theme }) => theme.fontSize.h3};
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: ${({ theme }) => theme.color.bola[700]};
  }

  span {
    font-size: ${({ theme }) => theme.fontSize.micro};
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.muted};
  }
`

const MEDALHAS = ['🥇', '🥈', '🥉'] as const

/**
 * Ranking de artilharia.
 *
 * O número grande é a ARTILHARIA LÍQUIDA — é ela que ordena o ranking. A
 * decomposição embaixo mostra gols físicos, de goleiro e contra separadamente,
 * porque 26 no placar não é o mesmo que 26 bolas (§31, §22).
 */
export function Artilharia({
  linhas,
  jogadores,
  limite,
}: {
  linhas: ScorerRow[]
  jogadores: LinhaJogador[]
  limite?: number
}) {
  const porId = new Map(jogadores.map((j) => [j.id, j]))
  const visiveis = limite === undefined ? linhas : linhas.slice(0, limite)

  return (
    <ListaArtilharia>
      {visiveis.map((l, i) => {
        const jogador = porId.get(l.playerId)
        return (
          <Artilheiro key={l.playerId} $lider={l.position === 1}>
            <Link to={`/players/${l.playerId}`}>
              <Medalha aria-hidden="true">{MEDALHAS[i] ?? l.position}</Medalha>
              <Avatar nome={l.playerName} url={jogador?.foto_url} tamanho="sm" />
              <NomeArtilheiro>
                <strong>{l.playerName}</strong>
                <span>
                  {l.teamName !== '' ? `${l.teamName} · ` : ''}
                  {l.goals} {l.goals === 1 ? 'gol' : 'gols'}
                  {l.keeperGoals > 0 && ` · ${l.keeperGoals} de goleiro`}
                  {l.ownGoals > 0 && ` · ${l.ownGoals} contra`}
                </span>
                {l.unresolvedTie && <Badge $tom="aviso">empatado</Badge>}
              </NomeArtilheiro>
              <Gols>
                <strong>{l.artilhariaLiquida}</strong>
                <span>artilharia</span>
              </Gols>
            </Link>
          </Artilheiro>
        )
      })}
    </ListaArtilharia>
  )
}
