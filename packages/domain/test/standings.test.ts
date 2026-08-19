import { beforeEach, describe, expect, it } from 'vitest'
import { computeStandings, unresolvedTieGroups } from '../src/standings.js'
import type { Team } from '../src/types.js'
import { finishedMatch, goal, goals, resetSeq } from './helpers.js'

const teams: Team[] = [
  { id: 'tA', name: 'ALFA', playerIds: ['F', 'K'] },
  { id: 'tB', name: 'BRAVO', playerIds: ['J', 'Q'] },
  { id: 'tC', name: 'CHARLIE', playerIds: ['L', 'M'] },
]

beforeEach(resetSeq)

describe('classificação', () => {
  it('lista todas as equipes mesmo sem partidas jogadas', () => {
    const rows = computeStandings(teams, [])
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.j === 0 && r.pts === 0)).toBe(true)
  })

  it('ordena por pontos (primeiro critério oficial)', () => {
    const rows = computeStandings(teams, [
      finishedMatch('m1', 'tA', 'tB', goals(2, 'NORMAL_GOAL', 'tA', 'F')),
      finishedMatch('m2', 'tB', 'tC', goals(1, 'NORMAL_GOAL', 'tB', 'J')),
    ])
    expect(rows[0]?.teamId).toBe('tA')
    expect(rows[0]?.pts).toBe(3)
    expect(rows[2]?.teamId).toBe('tC')
    expect(rows[2]?.pts).toBe(0)
  })

  it('usa o saldo de gols como segundo critério', () => {
    // tA e tB terminam com 3 pontos; tA tem saldo maior.
    const rows = computeStandings(teams, [
      finishedMatch('m1', 'tA', 'tC', goals(5, 'NORMAL_GOAL', 'tA', 'F')),
      finishedMatch('m2', 'tB', 'tC', goals(1, 'NORMAL_GOAL', 'tB', 'J')),
    ])
    expect(rows[0]?.teamId).toBe('tA')
    expect(rows[0]?.saldo).toBe(5)
    expect(rows[1]?.teamId).toBe('tB')
    expect(rows[1]?.saldo).toBe(1)
  })

  it('o saldo considera o valor ponderado do gol de goleiro', () => {
    const rows = computeStandings(teams, [
      finishedMatch('m1', 'tA', 'tC', goals(3, 'KEEPER_GOAL', 'tA', 'F')),
    ])
    const alfa = rows.find((r) => r.teamId === 'tA')
    expect(alfa?.goals).toBe(3)
    expect(alfa?.gf).toBe(6)
    expect(alfa?.saldo).toBe(6)
  })

  it('empate distribui 1 ponto para cada equipe', () => {
    const rows = computeStandings(teams, [
      finishedMatch('m1', 'tA', 'tB', [
        goal('NORMAL_GOAL', 'tA', 'F'),
        goal('NORMAL_GOAL', 'tB', 'J'),
      ]),
    ])
    expect(rows.find((r) => r.teamId === 'tA')?.pts).toBe(1)
    expect(rows.find((r) => r.teamId === 'tB')?.pts).toBe(1)
    expect(rows.find((r) => r.teamId === 'tA')?.e).toBe(1)
  })

  it('considera apenas partidas da fase de grupos', () => {
    const rows = computeStandings(teams, [
      finishedMatch('m1', 'tA', 'tB', goals(4, 'NORMAL_GOAL', 'tA', 'F'), {
        phaseKind: 'KNOCKOUT',
      }),
    ])
    expect(rows.every((r) => r.j === 0)).toBe(true)
  })
})

describe('empates que os critérios oficiais não resolvem', () => {
  it('marca e agrupa equipes iguais em pontos e saldo', () => {
    // tA e tB vencem tC pelo mesmo placar: mesmos pontos, mesmo saldo.
    const rows = computeStandings(teams, [
      finishedMatch('m1', 'tA', 'tC', goals(2, 'NORMAL_GOAL', 'tA', 'F')),
      finishedMatch('m2', 'tB', 'tC', goals(2, 'NORMAL_GOAL', 'tB', 'J')),
    ])
    const alfa = rows.find((r) => r.teamId === 'tA')
    const bravo = rows.find((r) => r.teamId === 'tB')
    expect(alfa?.pts).toBe(bravo?.pts)
    expect(alfa?.saldo).toBe(bravo?.saldo)
    // Mesma posição: o sistema não inventa um terceiro critério.
    expect(alfa?.position).toBe(1)
    expect(bravo?.position).toBe(1)
    expect(alfa?.unresolvedTie).toBe(true)
    expect(bravo?.unresolvedTie).toBe(true)

    const grupos = unresolvedTieGroups(rows)
    expect(grupos).toHaveLength(1)
    expect(grupos[0]?.map((r) => r.teamId).sort()).toEqual(['tA', 'tB'])
  })

  it('não marca empate quando o saldo separa as equipes', () => {
    const rows = computeStandings(teams, [
      finishedMatch('m1', 'tA', 'tC', goals(5, 'NORMAL_GOAL', 'tA', 'F')),
      finishedMatch('m2', 'tB', 'tC', goals(1, 'NORMAL_GOAL', 'tB', 'J')),
    ])
    expect(rows.find((r) => r.teamId === 'tA')?.unresolvedTie).toBe(false)
    expect(rows.find((r) => r.teamId === 'tB')?.unresolvedTie).toBe(false)
    expect(unresolvedTieGroups(rows)).toHaveLength(0)
  })
})
