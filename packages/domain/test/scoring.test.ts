import { beforeEach, describe, expect, it } from 'vitest'
import { activeGoals, computeMatchScore, goalValue, scoreOf } from '../src/scoring.js'
import { goal, goals, removal, resetSeq } from './helpers.js'

const A = 'timeA'
const B = 'timeB'

beforeEach(resetSeq)

describe('valor de cada tipo de gol (regra oficial)', () => {
  it('GOL NORMAL vale 1', () => {
    expect(goalValue('NORMAL_GOAL')).toBe(1)
  })

  it('GOL DE GOLEIRO vale 2', () => {
    expect(goalValue('KEEPER_GOAL')).toBe(2)
  })

  it('GOL CONTRA vale 1', () => {
    expect(goalValue('OWN_GOAL')).toBe(1)
  })
})

describe('gol normal', () => {
  it('soma 1 no placar e 1 na artilharia do jogador', () => {
    const s = computeMatchScore(A, B, [goal('NORMAL_GOAL', A, 'F')])
    expect(s.teamA.gf).toBe(1)
    expect(s.teamB.gc).toBe(1)
    expect(s.teamA.goals).toBe(1)
    expect(s.players.get('F')?.goals).toBe(1)
    expect(s.players.get('F')?.goalValue).toBe(1)
  })
})

describe('gol de goleiro', () => {
  it('soma 2 no placar e 2 na artilharia, contando como 1 gol físico', () => {
    const s = computeMatchScore(A, B, [goal('KEEPER_GOAL', A, 'F')])
    expect(s.teamA.gf).toBe(2)
    expect(s.teamB.gc).toBe(2)
    expect(s.teamA.goals).toBe(1)
    expect(s.teamA.keeperGoals).toBe(1)
    expect(s.players.get('F')?.goals).toBe(1)
    expect(s.players.get('F')?.goalValue).toBe(2)
  })
})

describe('gol contra', () => {
  it('credita 1 ao adversário sem tirar nada do placar de quem cometeu', () => {
    // Time A = 10, Time B = 8, então F (do time A) faz gol contra.
    const events = [
      ...goals(10, 'NORMAL_GOAL', A, 'F'),
      ...goals(8, 'NORMAL_GOAL', B, 'J'),
      goal('OWN_GOAL', A, 'F'),
    ]
    const [scoreA, scoreB] = scoreOf(A, B, events)
    expect(scoreA).toBe(10)
    expect(scoreB).toBe(9)
  })

  it('NUNCA vale 2, mesmo cometido pelo goleiro', () => {
    const s = computeMatchScore(A, B, [goal('OWN_GOAL', A, 'goleiro')])
    expect(s.teamB.gf).toBe(1)
    expect(s.teamA.gc).toBe(1)
  })

  it('não conta como gol oficial do jogador nem do time', () => {
    const s = computeMatchScore(A, B, [goal('OWN_GOAL', A, 'F')])
    expect(s.teamA.goals).toBe(0)
    expect(s.teamA.ownGoals).toBe(1)
    expect(s.players.get('F')?.goals).toBe(0)
    expect(s.players.get('F')?.ownGoals).toBe(1)
    expect(s.players.get('F')?.goalValue).toBe(0)
    expect(s.players.get('F')?.netGoalValue).toBe(-1)
  })

  it('não aumenta a quantidade física de gols do time beneficiado', () => {
    const s = computeMatchScore(A, B, [goal('OWN_GOAL', A, 'F')])
    expect(s.teamB.goals).toBe(0)
    expect(s.teamB.gf).toBe(1)
  })
})

describe('exemplo oficial: 18 gols físicos com 3 de goleiro', () => {
  it('resulta em 18 gols, 3 de goleiro e placar 21', () => {
    const events = [...goals(15, 'NORMAL_GOAL', A, 'F'), ...goals(3, 'KEEPER_GOAL', A, 'K')]
    const s = computeMatchScore(A, B, events)
    expect(s.teamA.goals).toBe(18)
    expect(s.teamA.keeperGoals).toBe(3)
    expect(s.teamA.gf).toBe(21)
  })
})

describe('remoção de gol', () => {
  it('anula o evento apontado sem apagar o histórico', () => {
    const g1 = goal('NORMAL_GOAL', A, 'F')
    const g2 = goal('KEEPER_GOAL', A, 'F')
    const events = [g1, g2, removal(g2.id)]
    const s = computeMatchScore(A, B, events)
    expect(s.teamA.gf).toBe(1)
    expect(s.removedEventIds.has(g2.id)).toBe(true)
    expect(events).toHaveLength(3)
  })

  it('remove exatamente o evento indicado, não o último', () => {
    const g1 = goal('NORMAL_GOAL', A, 'F')
    const g2 = goal('NORMAL_GOAL', A, 'J')
    const s = computeMatchScore(A, B, [g1, g2, removal(g1.id)])
    expect(s.players.get('F')).toBeUndefined()
    expect(s.players.get('J')?.goals).toBe(1)
  })

  it('devolve gol contra removido ao placar correto', () => {
    const og = goal('OWN_GOAL', A, 'F')
    const s = computeMatchScore(A, B, [og, removal(og.id)])
    expect(s.teamB.gf).toBe(0)
    expect(s.teamA.ownGoals).toBe(0)
  })

  it('lista apenas os gols válidos em activeGoals', () => {
    const g1 = goal('NORMAL_GOAL', A, 'F')
    const g2 = goal('NORMAL_GOAL', B, 'J')
    expect(activeGoals([g1, g2, removal(g1.id)]).map((e) => e.id)).toEqual([g2.id])
  })
})

describe('ordenação e consistência', () => {
  it('o placar independe da ordem em que os eventos chegam', () => {
    const g1 = goal('NORMAL_GOAL', A, 'F')
    const g2 = goal('KEEPER_GOAL', B, 'J')
    const g3 = goal('OWN_GOAL', B, 'J')
    const embaralhado = [g3, g1, g2]
    expect(scoreOf(A, B, embaralhado)).toEqual(scoreOf(A, B, [g1, g2, g3]))
  })

  it('o placar é sempre a soma dos eventos válidos', () => {
    const events = [
      ...goals(3, 'NORMAL_GOAL', A, 'F'),
      ...goals(2, 'KEEPER_GOAL', A, 'K'),
      goal('OWN_GOAL', B, 'J'),
    ]
    // 3×1 + 2×2 + 1 (gol contra do adversário) = 8
    expect(scoreOf(A, B, events)[0]).toBe(8)
  })
})
