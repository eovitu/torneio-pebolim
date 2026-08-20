/**
 * Tradução entre as linhas do banco e as formas do domínio.
 *
 * O domínio é puro e não conhece Supabase (§50). Esta camada existe para que
 * ele continue assim: converte `match_events` em `MatchEvent` e as colunas de
 * relógio de `matches` em `MatchClock`, sem levar nada do banco para dentro
 * das regras.
 */

import type { MatchClock, MatchEvent } from '@pebolim/domain'
import type { Tables } from '../lib/database.types'

type LinhaEvento = Tables<'match_events'>
type LinhaPartida = Tables<'matches'>

/** Epoch em ms, ou `null` quando a coluna está vazia. */
function paraEpoch(iso: string | null): number | null {
  return iso === null ? null : Date.parse(iso)
}

export function paraEventoDoDominio(linha: LinhaEvento): MatchEvent {
  const comum = {
    id: linha.id,
    seq: linha.seq,
    clockMs: linha.clock_ms,
    createdAt: linha.created_at,
    createdBy: linha.created_by,
  }

  switch (linha.type) {
    case 'NORMAL_GOAL':
    case 'KEEPER_GOAL':
    case 'OWN_GOAL':
      return {
        ...comum,
        type: linha.type,
        // As constraints do banco garantem que gol sempre tem equipe e autor.
        teamId: linha.team_id ?? '',
        playerId: linha.player_id ?? '',
      }
    case 'GOAL_REMOVED':
      return {
        ...comum,
        type: 'GOAL_REMOVED',
        removedEventId: linha.removed_event_id ?? '',
        reason: linha.reason,
      }
    default:
      return { ...comum, type: linha.type }
  }
}

export function paraRelogioDoDominio(partida: LinhaPartida): MatchClock {
  return {
    startedAt: paraEpoch(partida.started_at),
    pausedAt: paraEpoch(partida.paused_at),
    accumulatedPausedMs: partida.accumulated_paused_ms,
    finishedAt: paraEpoch(partida.finished_at),
  }
}
