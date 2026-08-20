/**
 * Time que existe para sempre — o CLUBE — e o histórico somado dele.
 *
 * `teams` é a participação de um time em UM torneio; `clubs` é a identidade
 * permanente por trás dessas participações. Somar a campanha do clube é somar
 * as participações: nenhuma regra esportiva nova entra aqui, e a classificação
 * de cada torneio continua exatamente como estava (§35).
 *
 * O domínio já agrega qualquer conjunto de partidas — `computeTeamStats` e
 * `computeScorerRanking` não sabem, nem precisam saber, se as partidas vieram
 * de um campeonato ou de dez (§50).
 */

import {
  computeMatchScore,
  computePlayerStats,
  computeScorerRanking,
  computeTeamStats,
  emptyTeamStats,
} from '@pebolim/domain'
import type { MatchWithEvents, ScorerRow, TeamStats } from '@pebolim/domain'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { paraEventoDoDominio } from '../partida/adaptadores'

export interface PartidaDoClube {
  linha: Tables<'matches'>
  torneio: string
  nomeAdversario: string
  placarClube: number
  placarAdversario: number
}

export interface Clube {
  clube: Tables<'clubs'>
  /** A dupla permanente. */
  membros: Tables<'players'>[]
  /** Uma linha por torneio disputado. */
  participacoes: { equipe: Tables<'teams'>; torneio: Tables<'tournaments'> }[]
  /** Campanha somada de todas as participações. */
  campanha: TeamStats
  /** Artilharia somada de quem jogou pelo clube. Maior artilheiro é o primeiro. */
  artilharia: ScorerRow[]
  /** Todo mundo que já vestiu a camisa — para nome e foto na artilharia. */
  jogadores: Tables<'players'>[]
  partidas: PartidaDoClube[]
}

/**
 * Soma duas campanhas. `teamId` do resultado é o do clube, não o de uma
 * participação — a linha somada não pertence a nenhum torneio isolado.
 */
function somar(a: TeamStats, b: TeamStats): TeamStats {
  return {
    teamId: a.teamId,
    j: a.j + b.j,
    v: a.v + b.v,
    e: a.e + b.e,
    d: a.d + b.d,
    pts: a.pts + b.pts,
    goals: a.goals + b.goals,
    keeperGoals: a.keeperGoals + b.keeperGoals,
    ownGoals: a.ownGoals + b.ownGoals,
    gf: a.gf + b.gf,
    gc: a.gc + b.gc,
    saldo: a.saldo + b.saldo,
  }
}

export async function carregarClube(clubId: string): Promise<Clube | null> {
  const [c, m, te] = await Promise.all([
    supabase.from('clubs').select('*').eq('id', clubId).maybeSingle(),
    supabase.from('club_members').select('*').eq('club_id', clubId),
    supabase.from('teams').select('*').eq('club_id', clubId),
  ])
  if (c.data === null) return null
  const clube = c.data

  const equipes = te.data ?? []
  const idsEquipe = equipes.map((e) => e.id)
  const idsTorneio = [...new Set(equipes.map((e) => e.tournament_id))]

  // `.in([])` no PostgREST não filtra nada — sem participação, não há o que buscar.
  const [torn, part] = await Promise.all([
    idsTorneio.length === 0
      ? Promise.resolve({ data: [] as Tables<'tournaments'>[] })
      : supabase.from('tournaments').select('*').in('id', idsTorneio),
    idsEquipe.length === 0
      ? Promise.resolve({ data: [] as Tables<'matches'>[] })
      : supabase.from('matches').select('*').in('tournament_id', idsTorneio).order('created_at'),
  ])

  const torneios = torn.data ?? []
  const conjuntoEquipe = new Set(idsEquipe)
  const partidasDoClube = (part.data ?? []).filter(
    (p) => conjuntoEquipe.has(p.team_a_id) || conjuntoEquipe.has(p.team_b_id),
  )
  const idsPartida = partidasDoClube.map((p) => p.id)

  const [ml, ev, adv] = await Promise.all([
    idsPartida.length === 0
      ? Promise.resolve({ data: [] as Tables<'match_lineups'>[] })
      : supabase.from('match_lineups').select('*').in('match_id', idsPartida),
    idsPartida.length === 0
      ? Promise.resolve({ data: [] as Tables<'match_events'>[] })
      : supabase.from('match_events').select('*').in('match_id', idsPartida).order('seq'),
    idsTorneio.length === 0
      ? Promise.resolve({ data: [] as Tables<'teams'>[] })
      : supabase.from('teams').select('*').in('tournament_id', idsTorneio),
  ])

  const escalacoes = ml.data ?? []
  const eventos = ev.data ?? []
  const equipesEnvolvidas = adv.data ?? []

  const dominio: MatchWithEvents[] = partidasDoClube.map((linha) => ({
    id: linha.id,
    teamAId: linha.team_a_id,
    teamBId: linha.team_b_id,
    phaseKind: linha.phase_kind,
    status: linha.status,
    lineupA: escalacoes
      .filter((l) => l.match_id === linha.id && l.team_id === linha.team_a_id)
      .map((l) => l.player_id),
    lineupB: escalacoes
      .filter((l) => l.match_id === linha.id && l.team_id === linha.team_b_id)
      .map((l) => l.player_id),
    events: eventos.filter((x) => x.match_id === linha.id).map(paraEventoDoDominio),
  }))

  const porEquipe = computeTeamStats(dominio)
  const campanha = idsEquipe.reduce(
    (acc, id) => somar(acc, porEquipe.get(id) ?? emptyTeamStats(id)),
    emptyTeamStats(clubId),
  )

  // Quem defendeu o clube: os membros permanentes mais quem entrou por rodízio
  // em alguma participação. A artilharia do clube é a deles, somada.
  const idsJogador = [
    ...new Set([
      ...(m.data ?? []).map((x) => x.player_id),
      ...escalacoes.filter((l) => conjuntoEquipe.has(l.team_id)).map((l) => l.player_id),
    ]),
  ]
  const jog =
    idsJogador.length === 0
      ? { data: [] as Tables<'players'>[] }
      : await supabase.from('players').select('*').in('id', idsJogador).order('nome')
  const jogadores = jog.data ?? []

  // Filtrar ANTES de ranquear: `computeScorerRanking` atribui posição e marca
  // empate olhando a lista inteira. Cortar linhas depois deixaria posições
  // furadas e empates rotulados errado.
  const estatisticasDeJogador = computePlayerStats(dominio)
  const artilharia = computeScorerRanking(
    jogadores
      .filter((j) => (estatisticasDeJogador.get(j.id)?.j ?? 0) > 0)
      .map((j) => ({ id: j.id, name: j.nome })),
    dominio,
    { teamOf: () => ({ id: clubId, name: clube.nome }) },
  )

  const nomeEquipe = new Map(equipesEnvolvidas.map((e) => [e.id, e.nome]))
  const nomeTorneio = new Map(torneios.map((t) => [t.id, t.nome]))

  const partidas: PartidaDoClube[] = partidasDoClube.map((linha) => {
    const placar = computeMatchScore(
      linha.team_a_id,
      linha.team_b_id,
      eventos.filter((x) => x.match_id === linha.id).map(paraEventoDoDominio),
    )
    const souA = conjuntoEquipe.has(linha.team_a_id)
    return {
      linha,
      torneio: nomeTorneio.get(linha.tournament_id) ?? '—',
      nomeAdversario: nomeEquipe.get(souA ? linha.team_b_id : linha.team_a_id) ?? '—',
      placarClube: souA ? placar.teamA.gf : placar.teamB.gf,
      placarAdversario: souA ? placar.teamB.gf : placar.teamA.gf,
    }
  })

  return {
    clube,
    membros: jogadores.filter((j) => (m.data ?? []).some((x) => x.player_id === j.id)),
    participacoes: equipes.flatMap((e) => {
      const t = torneios.find((x) => x.id === e.tournament_id)
      return t === undefined ? [] : [{ equipe: e, torneio: t }]
    }),
    campanha,
    artilharia,
    jogadores,
    partidas,
  }
}
