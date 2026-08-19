/**
 * Artilharia.
 *
 * O ranking usa a ARTILHARIA LÍQUIDA: soma do valor dos gols oficiais
 * (normal = 1, goleiro = 2) menos os gols contra (−1 cada).
 *
 * Exemplo oficial: F tem 31 ocorrências de bola associadas a ele, 1 é gol
 * contra → 30 gols oficiais, artilharia 30, artilharia líquida 29.
 *
 * Assim como na classificação, não existe critério de desempate definido para
 * a artilharia. Empates recebem a mesma posição e são marcados.
 */

import type { PlayerStats } from './stats.js'
import { computePlayerStats, emptyPlayerStats } from './stats.js'
import type { MatchWithEvents } from './stats.js'
import type { Player } from './types.js'

export interface ScorerRow extends PlayerStats {
  position: number
  playerName: string
  teamId: string | null
  teamName: string
  /** Total de ocorrências de bola associadas ao jogador: gols oficiais + gols contra. */
  occurrences: number
  unresolvedTie: boolean
}

export interface ScorerContext {
  /** Time de cada jogador, para exibição. */
  teamOf: (playerId: string) => { id: string; name: string } | null
}

export function computeScorerRanking(
  players: readonly Player[],
  matches: readonly MatchWithEvents[],
  context: ScorerContext,
  limit?: number,
): ScorerRow[] {
  const stats = computePlayerStats(matches)

  const rows = players
    .map((p) => {
      const s = stats.get(p.id) ?? emptyPlayerStats(p.id)
      const team = context.teamOf(p.id)
      return {
        ...s,
        playerName: p.name,
        teamId: team?.id ?? null,
        teamName: team?.name ?? '',
        occurrences: s.goals + s.ownGoals,
        position: 0,
        unresolvedTie: false,
      }
    })
    .sort(
      (a, b) =>
        b.artilhariaLiquida - a.artilhariaLiquida ||
        // Desempate não esportivo, apenas para estabilidade da lista.
        a.playerName.localeCompare(b.playerName, 'pt-BR'),
    )

  rows.forEach((row, i) => {
    const previous = rows[i - 1]
    const next = rows[i + 1]
    const tiesPrevious =
      previous !== undefined && previous.artilhariaLiquida === row.artilhariaLiquida
    const tiesNext = next !== undefined && next.artilhariaLiquida === row.artilhariaLiquida
    row.position = tiesPrevious && previous !== undefined ? previous.position : i + 1
    row.unresolvedTie = tiesPrevious || tiesNext
  })

  return limit === undefined ? rows : rows.slice(0, limit)
}
