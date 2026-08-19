/**
 * Tipos e constantes do domínio do campeonato de pebolim.
 *
 * Fonte de verdade das regras: documento oficial do projeto (Victor Hugo / eovitu).
 * Este pacote é puro — sem React, sem Supabase, sem I/O. As camadas de
 * persistência mapeiam linhas do Postgres para estas formas e vice-versa.
 */

/** Duração oficial da partida: 3 minutos. */
export const MATCH_DURATION_SECONDS = 180
export const MATCH_DURATION_MS = MATCH_DURATION_SECONDS * 1000

/** Padrão inicial do torneio — o administrador pode alterar ambos. */
export const DEFAULT_TEAMS_PER_TOURNAMENT = 4
export const DEFAULT_PLAYERS_PER_TEAM = 2

/** Pontuação da fase de grupos. */
export const POINTS_WIN = 3
export const POINTS_DRAW = 1
export const POINTS_LOSS = 0

/**
 * Valor de cada tipo de gol.
 *
 * - Gol normal vale 1.
 * - Gol de goleiro vale 2 — SEMPRE, em toda métrica derivada do valor do gol.
 * - Gol contra vale 1 — NUNCA 2, mesmo quando cometido pelo goleiro.
 */
export const GOAL_VALUE = {
  NORMAL_GOAL: 1,
  KEEPER_GOAL: 2,
  OWN_GOAL: 1,
} as const

export type GoalEventType = keyof typeof GOAL_VALUE

export type MatchEventType =
  | GoalEventType
  | 'GOAL_REMOVED'
  | 'MATCH_STARTED'
  | 'MATCH_PAUSED'
  | 'MATCH_RESUMED'
  | 'GOLDEN_GOAL_STARTED'
  | 'MATCH_FINISHED'

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'GOLDEN_GOAL' | 'FINISHED'

/** Fase à qual a partida pertence. Define se o empate é permitido. */
export type PhaseKind = 'GROUP' | 'KNOCKOUT'

export interface Player {
  id: string
  name: string
}

export interface Team {
  id: string
  name: string
  playerIds: string[]
}

interface MatchEventCommon {
  id: string
  /** Ordem monotônica dentro da partida, atribuída pelo banco. Nunca pelo cliente. */
  seq: number
  /** Milissegundos de tempo de jogo decorridos quando o evento ocorreu. */
  clockMs: number
  createdAt: string
  /** Perfil que registrou o evento (juiz, jogador ou admin). */
  createdBy: string | null
}

/**
 * Um gol. `teamId` e `playerId` identificam SEMPRE quem executou —
 * inclusive no gol contra, em que o beneficiado é o time adversário.
 */
export interface GoalEvent extends MatchEventCommon {
  type: GoalEventType
  teamId: string
  playerId: string
}

/** Remoção auditável de um gol. O evento original nunca é apagado. */
export interface GoalRemovedEvent extends MatchEventCommon {
  type: 'GOAL_REMOVED'
  removedEventId: string
  reason: string | null
}

/** Marcos de ciclo de vida da partida (início, pausa, retomada, gol de ouro, fim). */
export interface LifecycleEvent extends MatchEventCommon {
  type: 'MATCH_STARTED' | 'MATCH_PAUSED' | 'MATCH_RESUMED' | 'GOLDEN_GOAL_STARTED' | 'MATCH_FINISHED'
}

export type MatchEvent = GoalEvent | GoalRemovedEvent | LifecycleEvent

export interface Match {
  id: string
  tournamentId: string
  phaseKind: PhaseKind
  label: string
  teamAId: string
  teamBId: string
  status: MatchStatus
}

export function isGoalEvent(e: MatchEvent): e is GoalEvent {
  return e.type === 'NORMAL_GOAL' || e.type === 'KEEPER_GOAL' || e.type === 'OWN_GOAL'
}

export function isGoalRemovedEvent(e: MatchEvent): e is GoalRemovedEvent {
  return e.type === 'GOAL_REMOVED'
}
