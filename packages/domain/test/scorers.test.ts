import { beforeEach, describe, expect, it } from 'vitest'
import { computeScorerRanking } from '../src/scorers.js'
import type { Player } from '../src/types.js'
import { finishedMatch, goal, goals, resetSeq } from './helpers.js'

const A = 'timeA'
const B = 'timeB'

const players: Player[] = [
  { id: 'F', name: 'F' },
  { id: 'J', name: 'J' },
  { id: 'K', name: 'K' },
  { id: 'Q', name: 'Q' },
]

const context = {
  teamOf: (playerId: string) =>
    playerId === 'F' || playerId === 'K'
      ? { id: A, name: 'ALFA' }
      : { id: B, name: 'BRAVO' },
}

beforeEach(resetSeq)

describe('artilharia', () => {
  it('ordena pela artilharia líquida', () => {
    // Q=10, F=10 gols com 2 contra → 8, K=6, J=5 com 1 contra → 4
    const m = finishedMatch('m1', A, B, [
      ...goals(10, 'NORMAL_GOAL', A, 'F'),
      ...goals(2, 'OWN_GOAL', A, 'F'),
      ...goals(6, 'NORMAL_GOAL', A, 'K'),
      ...goals(10, 'NORMAL_GOAL', B, 'Q'),
      ...goals(5, 'NORMAL_GOAL', B, 'J'),
      goal('OWN_GOAL', B, 'J'),
    ])
    const ranking = computeScorerRanking(players, [m], context)
    expect(ranking.map((r) => [r.playerId, r.artilhariaLiquida])).toEqual([
      ['Q', 10],
      ['F', 8],
      ['K', 6],
      ['J', 4],
    ])
  })

  it('o gol de goleiro vale 2 na artilharia', () => {
    const m = finishedMatch('m1', A, B, [
      ...goals(3, 'NORMAL_GOAL', A, 'F'),
      ...goals(2, 'KEEPER_GOAL', A, 'F'),
    ])
    const f = computeScorerRanking(players, [m], context).find((r) => r.playerId === 'F')
    expect(f?.goals).toBe(5)
    expect(f?.keeperGoals).toBe(2)
    expect(f?.artilharia).toBe(7)
    expect(f?.artilhariaLiquida).toBe(7)
  })

  it('exemplo oficial: 31 ocorrências, 30 gols oficiais, líquida 29', () => {
    const m = finishedMatch('m1', A, B, [
      ...goals(30, 'NORMAL_GOAL', A, 'F'),
      goal('OWN_GOAL', A, 'F'),
    ])
    const f = computeScorerRanking(players, [m], context).find((r) => r.playerId === 'F')
    expect(f?.occurrences).toBe(31)
    expect(f?.goals).toBe(30)
    expect(f?.ownGoals).toBe(1)
    expect(f?.artilhariaLiquida).toBe(29)
  })

  it('exibe o time do jogador', () => {
    const m = finishedMatch('m1', A, B, [goal('NORMAL_GOAL', A, 'F')])
    const f = computeScorerRanking(players, [m], context).find((r) => r.playerId === 'F')
    expect(f?.teamId).toBe(A)
    expect(f?.teamName).toBe('ALFA')
  })

  it('inclui jogadores sem nenhum gol, zerados', () => {
    const ranking = computeScorerRanking(players, [], context)
    expect(ranking).toHaveLength(4)
    expect(ranking.every((r) => r.artilhariaLiquida === 0)).toBe(true)
  })

  it('respeita o limite quando informado', () => {
    const m = finishedMatch('m1', A, B, goals(3, 'NORMAL_GOAL', A, 'F'))
    expect(computeScorerRanking(players, [m], context, 2)).toHaveLength(2)
  })

  it('marca empates na artilharia com a mesma posição', () => {
    const m = finishedMatch('m1', A, B, [
      ...goals(4, 'NORMAL_GOAL', A, 'F'),
      ...goals(4, 'NORMAL_GOAL', B, 'J'),
    ])
    const ranking = computeScorerRanking(players, [m], context)
    const f = ranking.find((r) => r.playerId === 'F')
    const j = ranking.find((r) => r.playerId === 'J')
    expect(f?.position).toBe(1)
    expect(j?.position).toBe(1)
    expect(f?.unresolvedTie).toBe(true)
  })
})
