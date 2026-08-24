/**
 * Bracket gráfico da Copa (eliminação dupla).
 *
 * A montagem e a resolução da chave são as mesmas funções puras que o banco
 * espelha (`montarEliminacaoDupla` / `resolverEliminacaoDupla` em
 * @pebolim/domain) — esta tela só desenha o resultado, nunca decide quem
 * avança (§50). Como os dados vêm de `useCampeonato`, que já mantém um canal
 * Realtime aberto para `matches`, o desenho atualiza sozinho conforme os
 * confrontos são decididos, sem precisar recarregar a página (§38).
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { montarEliminacaoDupla, resolverEliminacaoDupla } from '@pebolim/domain'
import type { PlanoDeCopa, ResultadosDaCopa, SlotResolvido } from '@pebolim/domain'
import type { PartidaComContexto, LinhaEquipe, LinhaFase } from '../dados/campeonato'
import { midia } from '../design-system/tokens'

const Rolagem = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[6]};
  overflow-x: auto;
  padding-bottom: ${({ theme }) => theme.space[3]};
  -webkit-overflow-scrolling: touch;
`

const Ala = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
`

const TituloAla = styled.h3`
  font-size: ${({ theme }) => theme.fontSize.small};
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.muted};
  margin: 0;
`

const Colunas = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[4]};
`

const Coluna = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  gap: ${({ theme }) => theme.space[3]};
  min-width: 220px;
`

const RotuloRodada = styled.p`
  margin: 0 0 ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.fontSize.micro};
  font-weight: 700;
  color: ${({ theme }) => theme.color.muted};
  text-align: center;
`

const CartaoSlot = styled.div<{ $decidido?: boolean; $clicavel?: boolean }>`
  display: block;
  text-decoration: none;
  color: inherit;
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surface};
  overflow: hidden;
  ${({ $clicavel }) => $clicavel && `cursor: pointer;`}
`

const LadoSlot = styled.div<{ $vencedor?: boolean; $vazio?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.fontSize.caption};
  font-weight: ${({ $vencedor }) => ($vencedor ? 800 : 600)};
  color: ${({ theme, $vazio }) => ($vazio ? theme.color.muted : theme.color.text)};
  background: ${({ theme, $vencedor }) => ($vencedor ? theme.color.campo[50] : 'transparent')};

  span:first-child {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span:last-child {
    flex-shrink: 0;
    font-family: ${({ theme }) => theme.font.numero};
    font-variant-numeric: tabular-nums;
  }

  & + & {
    border-top: 1px solid ${({ theme }) => theme.color.borderSoft};
  }
`

const Vazio = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.space[5]};
  text-align: center;
  color: ${({ theme }) => theme.color.muted};
  font-size: ${({ theme }) => theme.fontSize.small};
`

const Raiz = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[6]};

  ${midia.md} {
    gap: ${({ theme }) => theme.space[7]};
  }
`

interface ChaveamentoArmazenado {
  ordem: string[]
  plano: { equipes: number }
}

/** Type guard tosco: só o suficiente para não estourar em runtime com um JSON inesperado. */
function comoChaveamento(valor: unknown): ChaveamentoArmazenado | null {
  if (valor === null || typeof valor !== 'object') return null
  const v = valor as Record<string, unknown>
  if (!Array.isArray(v.ordem) || typeof v.plano !== 'object' || v.plano === null) return null
  const plano = v.plano as Record<string, unknown>
  if (typeof plano.equipes !== 'number') return null
  return { ordem: v.ordem as string[], plano: { equipes: plano.equipes } }
}

function nomeDaEquipe(equipes: readonly LinhaEquipe[], id: string | null): string {
  if (id === null) return '—'
  return equipes.find((e) => e.id === id)?.nome ?? '—'
}

const ROTULOS_ALA: Record<'VENCEDORES' | 'PERDEDORES' | 'FINAIS', string> = {
  VENCEDORES: 'Chave dos vencedores',
  PERDEDORES: 'Chave dos perdedores',
  FINAIS: 'Finais',
}

function alaDoSlot(chave: SlotResolvido['chave']): keyof typeof ROTULOS_ALA {
  if (chave === 'VENCEDORES') return 'VENCEDORES'
  if (chave === 'PERDEDORES') return 'PERDEDORES'
  return 'FINAIS'
}

export function ChaveDaCopa({
  fase,
  partidas,
  equipes,
}: {
  fase: LinhaFase
  partidas: readonly PartidaComContexto[]
  equipes: readonly LinhaEquipe[]
}) {
  const chaveamento = comoChaveamento(fase.chaveamento)

  const plano: PlanoDeCopa | null = useMemo(() => {
    if (chaveamento === null) return null
    return montarEliminacaoDupla(chaveamento.plano.equipes)
  }, [chaveamento])

  const daFase = useMemo(
    () => partidas.filter((p) => p.linha.phase_id === fase.id),
    [partidas, fase.id],
  )

  const porSlot = useMemo(() => {
    const mapa = new Map<string, PartidaComContexto>()
    for (const p of daFase) {
      if (p.linha.slot !== null) mapa.set(p.linha.slot, p)
    }
    return mapa
  }, [daFase])

  const resolvidos = useMemo(() => {
    if (plano === null || chaveamento === null) return null
    const vencedorPorSlot = new Map<string, string>()
    for (const p of daFase) {
      if (p.linha.slot === null || p.linha.status !== 'FINISHED') continue
      if (p.linha.team_a_id === null || p.linha.team_b_id === null) continue
      const vencedor = p.placarA > p.placarB ? p.linha.team_a_id : p.linha.team_b_id
      vencedorPorSlot.set(p.linha.slot, vencedor)
    }
    const resultados: ResultadosDaCopa = { vencedorPorSlot }
    return resolverEliminacaoDupla(plano, chaveamento.ordem, resultados)
  }, [plano, chaveamento, daFase])

  if (resolvidos === null) {
    return <Vazio>A chave ainda não foi montada.</Vazio>
  }

  const alas: Array<keyof typeof ROTULOS_ALA> = ['VENCEDORES', 'PERDEDORES', 'FINAIS']

  return (
    <Raiz>
      {alas.map((ala) => {
        const doAla = resolvidos.filter((s) => alaDoSlot(s.chave) === ala && s.estado !== 'DISPENSADO')
        if (doAla.length === 0) return null

        const rodadas = [...new Set(doAla.map((s) => s.rodada))].sort((a, b) => a - b)

        return (
          <Ala key={ala}>
            <TituloAla>{ROTULOS_ALA[ala]}</TituloAla>
            <Rolagem>
              <Colunas>
                {rodadas.map((rodada) => {
                  const daRodada = doAla
                    .filter((s) => s.rodada === rodada)
                    .sort((a, b) => a.posicao - b.posicao)
                  return (
                    <Coluna key={rodada}>
                      <RotuloRodada>{daRodada[0]?.rotulo}</RotuloRodada>
                      {daRodada.map((slot) => {
                        const partida = porSlot.get(slot.id)
                        const nomeA = slot.byeA ? 'Bye' : nomeDaEquipe(equipes, slot.equipeA)
                        const nomeB = slot.byeB ? 'Bye' : nomeDaEquipe(equipes, slot.equipeB)
                        const conteudo = (
                          <>
                            <LadoSlot
                              $vencedor={slot.vencedor !== null && slot.vencedor === slot.equipeA}
                              $vazio={slot.equipeA === null}
                            >
                              <span>{nomeA}</span>
                              {partida !== undefined && <span>{partida.placarA}</span>}
                            </LadoSlot>
                            <LadoSlot
                              $vencedor={slot.vencedor !== null && slot.vencedor === slot.equipeB}
                              $vazio={slot.equipeB === null}
                            >
                              <span>{nomeB}</span>
                              {partida !== undefined && <span>{partida.placarB}</span>}
                            </LadoSlot>
                          </>
                        )
                        return partida !== undefined ? (
                          <CartaoSlot as={Link} to={`/matches/${partida.linha.id}`} key={slot.id} $clicavel>
                            {conteudo}
                          </CartaoSlot>
                        ) : (
                          <CartaoSlot key={slot.id}>{conteudo}</CartaoSlot>
                        )
                      })}
                    </Coluna>
                  )
                })}
              </Colunas>
            </Rolagem>
          </Ala>
        )
      })}
    </Raiz>
  )
}
