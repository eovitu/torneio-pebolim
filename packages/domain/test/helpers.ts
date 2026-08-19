import type { GoalEvent, GoalEventType, GoalRemovedEvent, MatchEvent } from '../src/types.js'
import type { MatchWithEvents } from '../src/stats.js'
import type { PhaseKind } from '../src/types.js'

let seq = 0
export function resetSeq(): void {
  seq = 0
}

/** Cria um evento de gol com `seq` crescente, imitando a ordenação do banco. */
export function goal(
  type: GoalEventType,
  teamId: string,
  playerId: string,
  id = `e${++seq}`,
): GoalEvent {
  return {
    id,
    seq: seq,
    type,
    teamId,
    playerId,
    clockMs: seq * 1000,
    createdAt: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
    createdBy: 'juiz',
  }
}

export function removal(removedEventId: string, id = `r${++seq}`): GoalRemovedEvent {
  return {
    id,
    seq: seq,
    type: 'GOAL_REMOVED',
    removedEventId,
    reason: null,
    clockMs: seq * 1000,
    createdAt: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
    createdBy: 'juiz',
  }
}

/** Repete um tipo de gol n vezes para o mesmo jogador. */
export function goals(
  n: number,
  type: GoalEventType,
  teamId: string,
  playerId: string,
): GoalEvent[] {
  return Array.from({ length: n }, () => goal(type, teamId, playerId))
}

export function finishedMatch(
  id: string,
  teamAId: string,
  teamBId: string,
  events: MatchEvent[],
  options: { phaseKind?: PhaseKind; lineupA?: string[]; lineupB?: string[] } = {},
): MatchWithEvents {
  return {
    id,
    teamAId,
    teamBId,
    phaseKind: options.phaseKind ?? 'GROUP',
    status: 'FINISHED',
    lineupA: options.lineupA ?? [],
    lineupB: options.lineupB ?? [],
    events,
  }
}
