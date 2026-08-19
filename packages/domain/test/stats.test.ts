import { beforeEach, describe, expect, it } from 'vitest'
import { computePlayerStats, computeTeamStats } from '../src/stats.js'
import { finishedMatch, goal, goals, resetSeq } from './helpers.js'

const A = 'timeA'
const B = 'timeB'

beforeEach(resetSeq)

describe('estatísticas de time', () => {
  it('separa quantidade de gols, gols de goleiro e valor do placar', () => {
    const m = finishedMatch('m1', A, B, [
      ...goals(15, 'NORMAL_GOAL', A, 'F'),
      ...goals(3, 'KEEPER_GOAL', A, 'K'),
    ])
    const a = computeTeamStats([m]).get(A)
    expect(a?.goals).toBe(18)
    expect(a?.keeperGoals).toBe(3)
    expect(a?.gf).toBe(21)
  })

  it('calcula saldo sobre o valor ponderado do placar', () => {
    // A faz 21 (15 normais + 3 de goleiro), B faz 15 normais
    const m = finishedMatch('m1', A, B, [
      ...goals(15, 'NORMAL_GOAL', A, 'F'),
      ...goals(3, 'KEEPER_GOAL', A, 'K'),
      ...goals(15, 'NORMAL_GOAL', B, 'J'),
    ])
    const a = computeTeamStats([m]).get(A)
    expect(a?.gf).toBe(21)
    expect(a?.gc).toBe(15)
    expect(a?.saldo).toBe(6)
  })

  it('registra gols contra separadamente e credita o adversário', () => {
    const m = finishedMatch('m1', A, B, [goal('OWN_GOAL', A, 'F')])
    const stats = computeTeamStats([m])
    expect(stats.get(A)?.ownGoals).toBe(1)
    expect(stats.get(A)?.goals).toBe(0)
    expect(stats.get(A)?.gc).toBe(1)
    expect(stats.get(B)?.gf).toBe(1)
    expect(stats.get(B)?.goals).toBe(0)
  })

  it('acumula vitória, empate e derrota com a pontuação correta', () => {
    const vitoriaA = finishedMatch('m1', A, B, [goal('NORMAL_GOAL', A, 'F')])
    const empate = finishedMatch('m2', A, B, [
      goal('NORMAL_GOAL', A, 'F'),
      goal('NORMAL_GOAL', B, 'J'),
    ])
    const derrotaA = finishedMatch('m3', A, B, [goal('KEEPER_GOAL', B, 'J')])
    const a = computeTeamStats([vitoriaA, empate, derrotaA]).get(A)
    expect(a?.j).toBe(3)
    expect(a?.v).toBe(1)
    expect(a?.e).toBe(1)
    expect(a?.d).toBe(1)
    expect(a?.pts).toBe(4)
  })

  it('ignora partidas que ainda não terminaram', () => {
    const emAndamento = { ...finishedMatch('m1', A, B, goals(5, 'NORMAL_GOAL', A, 'F')) }
    emAndamento.status = 'LIVE'
    expect(computeTeamStats([emAndamento]).size).toBe(0)
  })
})

describe('estatísticas de jogador', () => {
  it('conta jogos, vitórias, empates e derrotas pela escalação', () => {
    const m1 = finishedMatch('m1', A, B, [goal('NORMAL_GOAL', A, 'F')], {
      lineupA: ['F', 'K'],
      lineupB: ['J', 'Q'],
    })
    const m2 = finishedMatch('m2', A, B, [], { lineupA: ['F', 'K'], lineupB: ['J', 'Q'] })
    const stats = computePlayerStats([m1, m2])
    expect(stats.get('F')?.j).toBe(2)
    expect(stats.get('F')?.v).toBe(1)
    expect(stats.get('F')?.e).toBe(1)
    expect(stats.get('J')?.d).toBe(1)
    expect(stats.get('J')?.e).toBe(1)
  })

  it('pondera o gol de goleiro na artilharia', () => {
    const m = finishedMatch('m1', A, B, [
      ...goals(4, 'NORMAL_GOAL', A, 'F'),
      ...goals(2, 'KEEPER_GOAL', A, 'F'),
    ])
    const f = computePlayerStats([m]).get('F')
    expect(f?.goals).toBe(6)
    expect(f?.keeperGoals).toBe(2)
    expect(f?.artilharia).toBe(8)
    expect(f?.artilhariaLiquida).toBe(8)
  })

  it('exemplo oficial: 31 ocorrências, 1 gol contra, artilharia líquida 29', () => {
    const m = finishedMatch('m1', A, B, [
      ...goals(30, 'NORMAL_GOAL', A, 'F'),
      goal('OWN_GOAL', A, 'F'),
    ])
    const f = computePlayerStats([m]).get('F')
    expect(f?.goals).toBe(30)
    expect(f?.ownGoals).toBe(1)
    // 30 gols oficiais + 1 gol contra = 31 ocorrências
    expect((f?.goals ?? 0) + (f?.ownGoals ?? 0)).toBe(31)
    expect(f?.artilharia).toBe(30)
    expect(f?.artilhariaLiquida).toBe(29)
  })

  it('gol contra de goleiro desconta apenas 1', () => {
    const m = finishedMatch('m1', A, B, [
      ...goals(5, 'NORMAL_GOAL', A, 'goleiro'),
      goal('OWN_GOAL', A, 'goleiro'),
    ])
    const g = computePlayerStats([m]).get('goleiro')
    expect(g?.artilharia).toBe(5)
    expect(g?.artilhariaLiquida).toBe(4)
  })

  it('soma estatísticas do jogador ao longo de vários torneios de partidas', () => {
    const m1 = finishedMatch('m1', A, B, goals(3, 'NORMAL_GOAL', A, 'F'), { lineupA: ['F'] })
    const m2 = finishedMatch('m2', A, B, goals(2, 'KEEPER_GOAL', A, 'F'), { lineupA: ['F'] })
    const f = computePlayerStats([m1, m2]).get('F')
    expect(f?.j).toBe(2)
    expect(f?.goals).toBe(5)
    expect(f?.artilharia).toBe(7)
  })
})
