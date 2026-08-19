/**
 * Cronômetro da partida.
 *
 * A fonte de verdade é TEMPO ABSOLUTO (timestamps), nunca um contador
 * incrementado por renderização. O estado guardado é pequeno e o tempo é
 * sempre recalculado a partir dele, então trocar de aba, perder foco,
 * recarregar a página ou sofrer lentidão não altera o tempo real da partida.
 *
 * Regulamento: 180 s em contagem regressiva. No gol de ouro a contagem passa
 * a ser progressiva a partir de 00:00, sem limite (regra oficial).
 */

import { MATCH_DURATION_MS } from './types.js'
import type { MatchStatus } from './types.js'

export interface MatchClock {
  /** Epoch ms do início da partida. `null` enquanto SCHEDULED. */
  startedAt: number | null
  /** Epoch ms em que a pausa atual começou. `null` se não está pausada. */
  pausedAt: number | null
  /** Soma das pausas já encerradas, em ms. */
  accumulatedPausedMs: number
  /** Epoch ms em que a partida foi congelada ao terminar. `null` se não terminou. */
  finishedAt: number | null
}

export function initialClock(): MatchClock {
  return { startedAt: null, pausedAt: null, accumulatedPausedMs: 0, finishedAt: null }
}

/**
 * Tempo de jogo decorrido, em ms — já descontadas todas as pausas.
 * Cresce indefinidamente durante o gol de ouro.
 */
export function elapsedMs(clock: MatchClock, now: number): number {
  if (clock.startedAt === null) return 0
  const end = clock.finishedAt ?? clock.pausedAt ?? now
  const raw = end - clock.startedAt - clock.accumulatedPausedMs
  return Math.max(0, raw)
}

/** Tempo restante do tempo regulamentar, em ms. Nunca negativo. */
export function remainingMs(clock: MatchClock, now: number): number {
  return Math.max(0, MATCH_DURATION_MS - elapsedMs(clock, now))
}

/** True quando os 3 minutos regulamentares se esgotaram. */
export function isRegulationOver(clock: MatchClock, now: number): boolean {
  return elapsedMs(clock, now) >= MATCH_DURATION_MS
}

/** Tempo de gol de ouro decorrido (contagem progressiva a partir de 00:00). */
export function goldenGoalElapsedMs(clock: MatchClock, now: number): number {
  return Math.max(0, elapsedMs(clock, now) - MATCH_DURATION_MS)
}

/**
 * Valor que o cronômetro deve exibir, em ms, e em que direção.
 * Em GOLDEN_GOAL conta para cima; nos demais estados, para baixo.
 */
export function displayMs(clock: MatchClock, status: MatchStatus, now: number): number {
  return status === 'GOLDEN_GOAL' ? goldenGoalElapsedMs(clock, now) : remainingMs(clock, now)
}

/** Formata ms como MM:SS. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function start(clock: MatchClock, now: number): MatchClock {
  if (clock.startedAt !== null) return clock
  return { ...clock, startedAt: now }
}

export function pause(clock: MatchClock, now: number): MatchClock {
  if (clock.startedAt === null || clock.pausedAt !== null || clock.finishedAt !== null) return clock
  return { ...clock, pausedAt: now }
}

/** Retoma preservando o tempo restante — o cronômetro nunca reinicia. */
export function resume(clock: MatchClock, now: number): MatchClock {
  if (clock.pausedAt === null) return clock
  return {
    ...clock,
    pausedAt: null,
    accumulatedPausedMs: clock.accumulatedPausedMs + Math.max(0, now - clock.pausedAt),
  }
}

export function finish(clock: MatchClock, now: number): MatchClock {
  if (clock.finishedAt !== null) return clock
  const settled = clock.pausedAt === null ? clock : resume(clock, now)
  return { ...settled, finishedAt: now }
}
