/**
 * Classificação da fase de grupos.
 *
 * Critérios de desempate DEFINIDOS nas regras oficiais:
 *   1. pontos (desc)
 *   2. saldo de gols, sobre o valor ponderado do placar (desc)
 *
 * Não existe terceiro critério definido. Este módulo NÃO inventa um: quando
 * duas equipes permanecem iguais em pontos e saldo, elas recebem a MESMA
 * posição e são marcadas com `unresolvedTie`, para que a interface mostre o
 * empate honestamente e o administrador seja consultado. A ordenação final
 * por nome existe apenas para tornar a lista determinística — não é, e não
 * deve ser apresentada como, um critério esportivo.
 */

import type { TeamStats } from './stats.js'
import { computeTeamStats } from './stats.js'
import type { MatchWithEvents } from './stats.js'
import type { Team } from './types.js'
import { emptyTeamStats } from './stats.js'

export interface StandingsRow extends TeamStats {
  position: number
  teamName: string
  /** Empatado com outra equipe em pontos E saldo — critério seguinte indefinido. */
  unresolvedTie: boolean
}

/** Só a fase de grupos alimenta a classificação. */
export function groupMatches(matches: readonly MatchWithEvents[]): MatchWithEvents[] {
  return matches.filter((m) => m.phaseKind === 'GROUP')
}

function sameRank(a: TeamStats, b: TeamStats): boolean {
  return a.pts === b.pts && a.saldo === b.saldo
}

export function computeStandings(
  teams: readonly Team[],
  matches: readonly MatchWithEvents[],
): StandingsRow[] {
  const stats = computeTeamStats(groupMatches(matches))

  const rows = teams
    .map((t) => ({
      ...(stats.get(t.id) ?? emptyTeamStats(t.id)),
      teamName: t.name,
      position: 0,
      unresolvedTie: false,
    }))
    .sort(
      (a, b) =>
        b.pts - a.pts ||
        b.saldo - a.saldo ||
        // Desempate não esportivo, apenas para estabilidade da lista.
        a.teamName.localeCompare(b.teamName, 'pt-BR'),
    )

  rows.forEach((row, i) => {
    const previous = rows[i - 1]
    row.position = previous !== undefined && sameRank(previous, row) ? previous.position : i + 1
    const next = rows[i + 1]
    row.unresolvedTie =
      (previous !== undefined && sameRank(previous, row)) ||
      (next !== undefined && sameRank(next, row))
  })

  return rows
}

/**
 * Grupos de equipes que os critérios oficiais não conseguem separar.
 * Vazio quando a classificação está totalmente resolvida.
 */
export function unresolvedTieGroups(rows: readonly StandingsRow[]): StandingsRow[][] {
  const groups = new Map<number, StandingsRow[]>()
  for (const row of rows) {
    if (!row.unresolvedTie) continue
    const group = groups.get(row.position)
    if (group === undefined) groups.set(row.position, [row])
    else group.push(row)
  }
  return [...groups.values()]
}
