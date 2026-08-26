/**
 * Classificação da fase de grupos.
 *
 * Critérios de desempate DEFINIDOS nas regras oficiais:
 *   1. pontos (desc)
 *   2. saldo de gols, sobre o valor ponderado do placar (desc)
 *   3. confronto direto entre as equipes empatadas
 *
 * O confronto direto é um mini-campeonato entre as equipes que empataram nos
 * dois primeiros critérios: contam apenas os jogos delas entre si, primeiro por
 * pontos e depois por saldo. Com três ou mais equipes empatadas isso pode
 * separar só uma parte delas, e tudo bem — quem continuar igual segue empatado.
 *
 * Não existe quarto critério. Este módulo NÃO inventa um: quando duas equipes
 * permanecem iguais até no confronto direto, elas recebem a MESMA posição e são
 * marcadas com `unresolvedTie`, para que a interface mostre o empate
 * honestamente e o administrador seja consultado. A ordenação final por nome
 * existe apenas para tornar a lista determinística — não é, e não deve ser
 * apresentada como, um critério esportivo.
 */

import type { TeamStats } from './stats.js'
import { computeTeamStats } from './stats.js'
import type { MatchWithEvents } from './stats.js'
import type { Team } from './types.js'
import { emptyTeamStats } from './stats.js'

export interface StandingsRow extends TeamStats {
  position: number
  teamName: string
  /** Empatado com outra equipe em pontos, saldo E confronto direto. */
  unresolvedTie: boolean
}

/** Só a fase de grupos alimenta a classificação. */
export function groupMatches(matches: readonly MatchWithEvents[]): MatchWithEvents[] {
  return matches.filter((m) => m.phaseKind === 'GROUP')
}

/** Empatados nos dois primeiros critérios — é onde o confronto direto entra. */
function sameOverall(a: TeamStats, b: TeamStats): boolean {
  return a.pts === b.pts && a.saldo === b.saldo
}

/**
 * Confronto direto: mini-tabela contando só os jogos entre as equipes do grupo
 * empatado. Devolve as estatísticas de cada uma dentro desse recorte.
 */
function headToHead(
  teamIds: readonly string[],
  matches: readonly MatchWithEvents[],
): Map<string, TeamStats> {
  const inGroup = new Set(teamIds)
  const between = matches.filter((m) => inGroup.has(m.teamAId) && inGroup.has(m.teamBId))
  const table = computeTeamStats(between)
  for (const id of teamIds) {
    if (!table.has(id)) table.set(id, emptyTeamStats(id))
  }
  return table
}

export function computeStandings(
  teams: readonly Team[],
  matches: readonly MatchWithEvents[],
): StandingsRow[] {
  const relevant = groupMatches(matches)
  const stats = computeTeamStats(relevant)

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

  // Terceiro critério: dentro de cada bloco empatado em pontos e saldo, reordena
  // pelo confronto direto. Quem o confronto direto também não separa continua
  // lado a lado, e é isso que `unresolvedTie` vai marcar logo abaixo.
  const ordered: typeof rows = []
  const h2h = new Map<string, TeamStats>()
  for (let i = 0; i < rows.length; ) {
    let j = i + 1
    while (j < rows.length && sameOverall(rows[i]!, rows[j]!)) j += 1

    const block = rows.slice(i, j)
    if (block.length > 1) {
      const mini = headToHead(
        block.map((r) => r.teamId),
        relevant,
      )
      for (const [id, line] of mini) h2h.set(id, line)
      block.sort((a, b) => {
        const ma = mini.get(a.teamId)!
        const mb = mini.get(b.teamId)!
        return (
          mb.pts - ma.pts ||
          mb.saldo - ma.saldo ||
          a.teamName.localeCompare(b.teamName, 'pt-BR')
        )
      })
    }
    ordered.push(...block)
    i = j
  }

  /** Iguais até no confronto direto — aí acabaram os critérios. */
  const stillTied = (a: StandingsRow, b: StandingsRow): boolean => {
    if (!sameOverall(a, b)) return false
    const ma = h2h.get(a.teamId)
    const mb = h2h.get(b.teamId)
    if (ma === undefined || mb === undefined) return true
    return ma.pts === mb.pts && ma.saldo === mb.saldo
  }

  ordered.forEach((row, i) => {
    const previous = ordered[i - 1]
    row.position = previous !== undefined && stillTied(previous, row) ? previous.position : i + 1
    const next = ordered[i + 1]
    row.unresolvedTie =
      (previous !== undefined && stillTied(previous, row)) ||
      (next !== undefined && stillTied(next, row))
  })

  return ordered
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
