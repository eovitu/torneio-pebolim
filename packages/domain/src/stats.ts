/**
 * Agregação de estatísticas de time e de jogador ao longo de várias partidas.
 *
 * Só partidas FINISHED entram nas estatísticas — uma partida em andamento não
 * contamina tabela nem artilharia. Todos os números saem dos eventos, então
 * corrigir um evento corrige automaticamente toda métrica derivada.
 */

import type { MatchEvent, MatchStatus, PhaseKind } from './types.js'
import { computeMatchScore } from './scoring.js'
import { pointsFor, resultOf } from './match.js'

export interface MatchWithEvents {
  id: string
  teamAId: string
  teamBId: string
  phaseKind: PhaseKind
  status: MatchStatus
  /** Jogadores escalados em cada lado — base para contar jogos por jogador. */
  lineupA: readonly string[]
  lineupB: readonly string[]
  events: readonly MatchEvent[]
}

export interface TeamStats {
  teamId: string
  /** Jogos disputados. */
  j: number
  v: number
  e: number
  d: number
  pts: number
  /** Quantidade FÍSICA de gols marcados pelos jogadores do time. */
  goals: number
  /** Quantos daqueles gols foram de goleiro. */
  keeperGoals: number
  /** Gols contra cometidos pelos jogadores do time. */
  ownGoals: number
  /** Valor ponderado a favor (goleiro = 2). */
  gf: number
  /** Valor ponderado sofrido. */
  gc: number
  /** Saldo, sobre o valor ponderado: gf − gc. */
  saldo: number
}

export interface PlayerStats {
  playerId: string
  j: number
  v: number
  e: number
  d: number
  /** Gols oficiais (quantidade física). Gol contra não entra aqui. */
  goals: number
  keeperGoals: number
  ownGoals: number
  /** Artilharia bruta: soma do VALOR dos gols oficiais (goleiro = 2). */
  artilharia: number
  /** Artilharia líquida: artilharia − gols contra. */
  artilhariaLiquida: number
}

export function emptyTeamStats(teamId: string): TeamStats {
  return {
    teamId,
    j: 0,
    v: 0,
    e: 0,
    d: 0,
    pts: 0,
    goals: 0,
    keeperGoals: 0,
    ownGoals: 0,
    gf: 0,
    gc: 0,
    saldo: 0,
  }
}

export function emptyPlayerStats(playerId: string): PlayerStats {
  return {
    playerId,
    j: 0,
    v: 0,
    e: 0,
    d: 0,
    goals: 0,
    keeperGoals: 0,
    ownGoals: 0,
    artilharia: 0,
    artilhariaLiquida: 0,
  }
}

export function isCountable(m: MatchWithEvents): boolean {
  return m.status === 'FINISHED'
}

/** Estatísticas de todos os times, indexadas por `teamId`. */
export function computeTeamStats(matches: readonly MatchWithEvents[]): Map<string, TeamStats> {
  const table = new Map<string, TeamStats>()
  const lineOf = (teamId: string): TeamStats => {
    let row = table.get(teamId)
    if (row === undefined) {
      row = emptyTeamStats(teamId)
      table.set(teamId, row)
    }
    return row
  }

  for (const m of matches) {
    if (!isCountable(m)) continue
    const score = computeMatchScore(m.teamAId, m.teamBId, m.events)
    const result = resultOf(m.teamAId, m.teamBId, m.events)

    for (const side of ['TEAM_A', 'TEAM_B'] as const) {
      const isA = side === 'TEAM_A'
      const row = lineOf(isA ? m.teamAId : m.teamBId)
      const own = isA ? score.teamA : score.teamB

      row.j += 1
      row.goals += own.goals
      row.keeperGoals += own.keeperGoals
      row.ownGoals += own.ownGoals
      row.gf += own.gf
      row.gc += own.gc
      row.pts += pointsFor(result.outcome, side)
      if (result.outcome === 'DRAW') row.e += 1
      else if (result.outcome === side) row.v += 1
      else row.d += 1
    }
  }

  for (const row of table.values()) row.saldo = row.gf - row.gc
  return table
}

/** Estatísticas de todos os jogadores, indexadas por `playerId`. */
export function computePlayerStats(matches: readonly MatchWithEvents[]): Map<string, PlayerStats> {
  const table = new Map<string, PlayerStats>()
  const lineOf = (playerId: string): PlayerStats => {
    let row = table.get(playerId)
    if (row === undefined) {
      row = emptyPlayerStats(playerId)
      table.set(playerId, row)
    }
    return row
  }

  for (const m of matches) {
    if (!isCountable(m)) continue
    const score = computeMatchScore(m.teamAId, m.teamBId, m.events)
    const result = resultOf(m.teamAId, m.teamBId, m.events)

    for (const side of ['TEAM_A', 'TEAM_B'] as const) {
      const lineup = side === 'TEAM_A' ? m.lineupA : m.lineupB
      for (const playerId of lineup) {
        const row = lineOf(playerId)
        row.j += 1
        if (result.outcome === 'DRAW') row.e += 1
        else if (result.outcome === side) row.v += 1
        else row.d += 1
      }
    }

    for (const line of score.players.values()) {
      const row = lineOf(line.playerId)
      row.goals += line.goals
      row.keeperGoals += line.keeperGoals
      row.ownGoals += line.ownGoals
      row.artilharia += line.goalValue
    }
  }

  for (const row of table.values()) row.artilhariaLiquida = row.artilharia - row.ownGoals
  return table
}
