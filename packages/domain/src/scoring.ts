/**
 * Redução de eventos a placar e estatísticas de partida.
 *
 * Princípio central: o placar é SEMPRE derivado dos eventos. Nunca existe um
 * número de placar guardado que possa divergir do histórico. Um gol removido
 * não é apagado — é anulado por um evento `GOAL_REMOVED` que aponta para ele,
 * preservando a auditoria.
 *
 * Distinção obrigatória entre as métricas (regra oficial):
 *   - `goals`      quantidade FÍSICA de gols (bolas que entraram) — gol contra não conta
 *   - `keeperGoals` quantos daqueles gols foram de goleiro
 *   - `ownGoals`   gols contra cometidos
 *   - `gf` / `gc`  valor PONDERADO do placar (goleiro = 2, normal = 1, contra = 1)
 *
 * Exemplo oficial: 18 gols físicos, 3 deles de goleiro → gf = 15 + 3×2 = 21.
 * São 18 gols e 21 no placar. Nunca exibir 21 como quantidade de gols.
 */

import type { GoalEvent, GoalEventType, MatchEvent } from './types.js'
import { GOAL_VALUE, isGoalEvent, isGoalRemovedEvent } from './types.js'

/** Valor de um gol no placar e em toda métrica ponderada. */
export function goalValue(type: GoalEventType): number {
  return GOAL_VALUE[type]
}

/**
 * Time que RECEBE os pontos do gol.
 * No gol contra, quem pontua é o adversário de quem cometeu — e o time de
 * quem cometeu não perde nada do próprio placar.
 */
export function beneficiaryTeamId(e: GoalEvent, teamAId: string, teamBId: string): string {
  if (e.type !== 'OWN_GOAL') return e.teamId
  return e.teamId === teamAId ? teamBId : teamAId
}

export interface TeamScoreLine {
  teamId: string
  /** Valor ponderado a favor — é este o número do placar. */
  gf: number
  /** Valor ponderado sofrido. */
  gc: number
  /** Quantidade física de gols marcados pelos jogadores do time (exclui gols contra). */
  goals: number
  /** Quantos dos gols físicos foram de goleiro. */
  keeperGoals: number
  /** Gols contra cometidos por jogadores deste time. */
  ownGoals: number
}

export interface PlayerScoreLine {
  playerId: string
  teamId: string
  /** Gols oficiais (quantidade física). Gol contra não entra aqui. */
  goals: number
  keeperGoals: number
  ownGoals: number
  /** Soma do VALOR dos gols oficiais (goleiro = 2). É a artilharia bruta. */
  goalValue: number
  /** Artilharia líquida: valor dos gols oficiais menos os gols contra (−1 cada). */
  netGoalValue: number
}

export interface MatchScore {
  teamA: TeamScoreLine
  teamB: TeamScoreLine
  /** Gols válidos, em ordem de `seq`, já descontadas as remoções. */
  activeGoals: GoalEvent[]
  /** Ids de eventos anulados por `GOAL_REMOVED`. */
  removedEventIds: Set<string>
  players: Map<string, PlayerScoreLine>
}

function emptyTeamLine(teamId: string): TeamScoreLine {
  return { teamId, gf: 0, gc: 0, goals: 0, keeperGoals: 0, ownGoals: 0 }
}

function emptyPlayerLine(playerId: string, teamId: string): PlayerScoreLine {
  return { playerId, teamId, goals: 0, keeperGoals: 0, ownGoals: 0, goalValue: 0, netGoalValue: 0 }
}

/** Ordena por `seq` sem mutar a entrada. `seq` é atribuído pelo banco. */
export function orderEvents<T extends { seq: number }>(events: readonly T[]): T[] {
  return events.slice().sort((a, b) => a.seq - b.seq)
}

/** Ids de gols anulados por um evento de remoção. */
export function collectRemovedEventIds(events: readonly MatchEvent[]): Set<string> {
  const removed = new Set<string>()
  for (const e of events) {
    if (isGoalRemovedEvent(e)) removed.add(e.removedEventId)
  }
  return removed
}

/** Gols que ainda valem, em ordem cronológica. */
export function activeGoals(events: readonly MatchEvent[]): GoalEvent[] {
  const removed = collectRemovedEventIds(events)
  return orderEvents(events)
    .filter(isGoalEvent)
    .filter((e) => !removed.has(e.id))
}

/**
 * Reduz os eventos de uma partida a placar e estatísticas.
 * Eventos de times que não são os dois da partida são ignorados.
 */
export function computeMatchScore(
  teamAId: string,
  teamBId: string,
  events: readonly MatchEvent[],
): MatchScore {
  const teamA = emptyTeamLine(teamAId)
  const teamB = emptyTeamLine(teamBId)
  const players = new Map<string, PlayerScoreLine>()
  const removedEventIds = collectRemovedEventIds(events)
  const goals = orderEvents(events)
    .filter(isGoalEvent)
    .filter((e) => !removedEventIds.has(e.id))

  const lineOf = (teamId: string): TeamScoreLine | null =>
    teamId === teamAId ? teamA : teamId === teamBId ? teamB : null

  for (const e of goals) {
    const executor = lineOf(e.teamId)
    if (executor === null) continue

    const value = goalValue(e.type)
    const beneficiaryId = beneficiaryTeamId(e, teamAId, teamBId)
    const beneficiary = lineOf(beneficiaryId)
    const conceder = beneficiaryId === teamAId ? teamB : teamA
    if (beneficiary === null) continue

    beneficiary.gf += value
    conceder.gc += value

    let player = players.get(e.playerId)
    if (player === undefined) {
      player = emptyPlayerLine(e.playerId, e.teamId)
      players.set(e.playerId, player)
    }

    if (e.type === 'OWN_GOAL') {
      // Gol contra não é gol do jogador nem do time: só credita o adversário.
      executor.ownGoals += 1
      player.ownGoals += 1
    } else {
      executor.goals += 1
      player.goals += 1
      player.goalValue += value
      if (e.type === 'KEEPER_GOAL') {
        executor.keeperGoals += 1
        player.keeperGoals += 1
      }
    }
    player.netGoalValue = player.goalValue - player.ownGoals
  }

  return { teamA, teamB, activeGoals: goals, removedEventIds, players }
}

/** Placar da partida: [valor ponderado do time A, do time B]. */
export function scoreOf(
  teamAId: string,
  teamBId: string,
  events: readonly MatchEvent[],
): [number, number] {
  const s = computeMatchScore(teamAId, teamBId, events)
  return [s.teamA.gf, s.teamB.gf]
}
