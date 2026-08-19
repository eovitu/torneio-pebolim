/**
 * Resultado e máquina de estados da partida.
 *
 * Regras oficiais aplicadas aqui:
 *  - a partida termina pelo TEMPO (180 s), nunca por quantidade de gols;
 *  - na fase de grupos o empate é um resultado válido (1 ponto para cada);
 *  - no mata-mata o empate ao fim do tempo leva a GOL DE OURO, e o próximo
 *    gol válido — normal, de goleiro ou contra — encerra a partida.
 */

import type { MatchEvent, MatchStatus, PhaseKind } from './types.js'
import { POINTS_DRAW, POINTS_LOSS, POINTS_WIN } from './types.js'
import { computeMatchScore } from './scoring.js'

export type MatchOutcome = 'TEAM_A' | 'TEAM_B' | 'DRAW'

export interface MatchResult {
  outcome: MatchOutcome
  scoreA: number
  scoreB: number
  winnerTeamId: string | null
  loserTeamId: string | null
}

/** Resultado a partir do placar ponderado. Empate é um desfecho legítimo aqui. */
export function resultOf(
  teamAId: string,
  teamBId: string,
  events: readonly MatchEvent[],
): MatchResult {
  const { teamA, teamB } = computeMatchScore(teamAId, teamBId, events)
  const scoreA = teamA.gf
  const scoreB = teamB.gf
  if (scoreA > scoreB) {
    return { outcome: 'TEAM_A', scoreA, scoreB, winnerTeamId: teamAId, loserTeamId: teamBId }
  }
  if (scoreB > scoreA) {
    return { outcome: 'TEAM_B', scoreA, scoreB, winnerTeamId: teamBId, loserTeamId: teamAId }
  }
  return { outcome: 'DRAW', scoreA, scoreB, winnerTeamId: null, loserTeamId: null }
}

/** Pontos da fase de grupos para um dos lados. */
export function pointsFor(outcome: MatchOutcome, side: 'TEAM_A' | 'TEAM_B'): number {
  if (outcome === 'DRAW') return POINTS_DRAW
  return outcome === side ? POINTS_WIN : POINTS_LOSS
}

/** Estados em que registrar ou remover gol é permitido. */
export function canRegisterGoal(status: MatchStatus): boolean {
  return status === 'LIVE' || status === 'GOLDEN_GOAL'
}

/**
 * Estado para o qual a partida vai quando os 180 s se esgotam.
 * Só o mata-mata empatado entra em gol de ouro.
 */
export function statusAtRegulationEnd(phaseKind: PhaseKind, outcome: MatchOutcome): MatchStatus {
  if (phaseKind === 'KNOCKOUT' && outcome === 'DRAW') return 'GOLDEN_GOAL'
  return 'FINISHED'
}

/**
 * Um gol registrado durante o gol de ouro encerra a partida imediatamente —
 * inclusive o gol contra, que credita o adversário e decide o confronto.
 */
export function statusAfterGoal(status: MatchStatus): MatchStatus {
  return status === 'GOLDEN_GOAL' ? 'FINISHED' : status
}

const ALLOWED_TRANSITIONS: Record<MatchStatus, readonly MatchStatus[]> = {
  SCHEDULED: ['LIVE'],
  LIVE: ['PAUSED', 'GOLDEN_GOAL', 'FINISHED'],
  PAUSED: ['LIVE', 'FINISHED'],
  GOLDEN_GOAL: ['PAUSED', 'FINISHED'],
  FINISHED: [],
}

export function canTransition(from: MatchStatus, to: MatchStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

/** Lança quando a transição é incoerente — usado como guarda defensiva. */
export function assertTransition(from: MatchStatus, to: MatchStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`transição de partida inválida: ${from} → ${to}`)
  }
}

export function isFinished(status: MatchStatus): boolean {
  return status === 'FINISHED'
}

/** Uma partida encerrada só pode ser corrigida por administrador (regra oficial). */
export function requiresAdminToEdit(status: MatchStatus): boolean {
  return status === 'FINISHED'
}
