import { beforeEach, describe, expect, it } from 'vitest'
import {
  assertTransition,
  canRegisterGoal,
  canTransition,
  pointsFor,
  requiresAdminToEdit,
  resultOf,
  statusAfterGoal,
  statusAtRegulationEnd,
} from '../src/match.js'
import { goal, goals, resetSeq } from './helpers.js'

const A = 'timeA'
const B = 'timeB'

beforeEach(resetSeq)

describe('resultado da partida', () => {
  it('vence quem tem o maior valor de placar', () => {
    const r = resultOf(A, B, [...goals(2, 'NORMAL_GOAL', A, 'F'), goal('NORMAL_GOAL', B, 'J')])
    expect(r.outcome).toBe('TEAM_A')
    expect(r.winnerTeamId).toBe(A)
    expect(r.loserTeamId).toBe(B)
  })

  it('o gol de goleiro pode virar a partida sozinho', () => {
    // A tem 1 gol normal, B tem 1 gol de goleiro → 1 x 2
    const r = resultOf(A, B, [goal('NORMAL_GOAL', A, 'F'), goal('KEEPER_GOAL', B, 'J')])
    expect([r.scoreA, r.scoreB]).toEqual([1, 2])
    expect(r.outcome).toBe('TEAM_B')
  })

  it('reconhece empate', () => {
    const r = resultOf(A, B, [goal('KEEPER_GOAL', A, 'F'), ...goals(2, 'NORMAL_GOAL', B, 'J')])
    expect([r.scoreA, r.scoreB]).toEqual([2, 2])
    expect(r.outcome).toBe('DRAW')
    expect(r.winnerTeamId).toBeNull()
  })
})

describe('pontuação da fase de grupos', () => {
  it('vitória vale 3, empate 1 e derrota 0', () => {
    expect(pointsFor('TEAM_A', 'TEAM_A')).toBe(3)
    expect(pointsFor('TEAM_A', 'TEAM_B')).toBe(0)
    expect(pointsFor('DRAW', 'TEAM_A')).toBe(1)
    expect(pointsFor('DRAW', 'TEAM_B')).toBe(1)
  })
})

describe('fim do tempo regulamentar', () => {
  it('empate na fase de grupos encerra a partida', () => {
    expect(statusAtRegulationEnd('GROUP', 'DRAW')).toBe('FINISHED')
  })

  it('empate no mata-mata leva a gol de ouro', () => {
    expect(statusAtRegulationEnd('KNOCKOUT', 'DRAW')).toBe('GOLDEN_GOAL')
  })

  it('partida decidida encerra em qualquer fase', () => {
    expect(statusAtRegulationEnd('KNOCKOUT', 'TEAM_A')).toBe('FINISHED')
    expect(statusAtRegulationEnd('GROUP', 'TEAM_B')).toBe('FINISHED')
  })
})

describe('gol de ouro', () => {
  it('qualquer gol durante o gol de ouro encerra a partida', () => {
    expect(statusAfterGoal('GOLDEN_GOAL')).toBe('FINISHED')
  })

  it('gol contra também decide o gol de ouro, creditando o adversário', () => {
    const events = [
      ...goals(3, 'NORMAL_GOAL', A, 'F'),
      ...goals(3, 'NORMAL_GOAL', B, 'J'),
      goal('OWN_GOAL', A, 'F'),
    ]
    const r = resultOf(A, B, events)
    expect([r.scoreA, r.scoreB]).toEqual([3, 4])
    expect(r.winnerTeamId).toBe(B)
    expect(statusAfterGoal('GOLDEN_GOAL')).toBe('FINISHED')
  })

  it('um gol durante o tempo normal não encerra a partida', () => {
    expect(statusAfterGoal('LIVE')).toBe('LIVE')
  })
})

describe('estados da partida', () => {
  it('permite registrar gol apenas em LIVE e GOLDEN_GOAL', () => {
    expect(canRegisterGoal('LIVE')).toBe(true)
    expect(canRegisterGoal('GOLDEN_GOAL')).toBe(true)
    expect(canRegisterGoal('SCHEDULED')).toBe(false)
    expect(canRegisterGoal('PAUSED')).toBe(false)
    expect(canRegisterGoal('FINISHED')).toBe(false)
  })

  it('aceita apenas transições coerentes', () => {
    expect(canTransition('SCHEDULED', 'LIVE')).toBe(true)
    expect(canTransition('LIVE', 'PAUSED')).toBe(true)
    expect(canTransition('PAUSED', 'LIVE')).toBe(true)
    expect(canTransition('LIVE', 'GOLDEN_GOAL')).toBe(true)
    expect(canTransition('GOLDEN_GOAL', 'FINISHED')).toBe(true)
  })

  it('impede reabrir ou reiniciar partida encerrada', () => {
    expect(canTransition('FINISHED', 'LIVE')).toBe(false)
    expect(canTransition('FINISHED', 'GOLDEN_GOAL')).toBe(false)
    expect(() => assertTransition('FINISHED', 'LIVE')).toThrow(/inválida/)
  })

  it('impede pular direto de agendada para encerrada', () => {
    expect(canTransition('SCHEDULED', 'FINISHED')).toBe(false)
  })

  it('exige administrador para editar partida encerrada', () => {
    expect(requiresAdminToEdit('FINISHED')).toBe(true)
    expect(requiresAdminToEdit('LIVE')).toBe(false)
  })
})
