/**
 * Leitura e derivação do estado de um campeonato.
 *
 * Esta camada só busca linhas e as traduz para as formas do domínio. Nenhuma
 * regra esportiva vive aqui: placar, classificação, estatística e artilharia
 * saem de `computeMatchScore`, `computeStandings`, `computeTeamStats` e
 * `computeScorerRanking`, que são as funções cobertas por teste (§30, §50).
 *
 * O carregamento é escopado por torneio: eventos e escalações são filtrados
 * pelos ids das partidas daquele torneio, em vez de trazer a tabela inteira.
 * Com realtime rodando durante uma partida, essa diferença é o que separa uma
 * consulta barata de puxar o histórico do campeonato a cada gol.
 */

import {
  computeMatchScore,
  computePlayerStats,
  computeScorerRanking,
  computeStandings,
  computeTeamStats,
} from '@pebolim/domain'
import type {
  MatchScore,
  MatchWithEvents,
  PlayerStats,
  ScorerRow,
  StandingsRow,
  TeamStats,
} from '@pebolim/domain'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { paraEventoDoDominio } from '../partida/adaptadores'

export type LinhaTorneio = Tables<'tournaments'>
export type LinhaEquipe = Tables<'teams'>
export type LinhaJogador = Tables<'players'>
export type LinhaPartida = Tables<'matches'>
export type LinhaFase = Tables<'phases'>

export interface PartidaComContexto {
  linha: LinhaPartida
  equipeA: LinhaEquipe | undefined
  equipeB: LinhaEquipe | undefined
  nomeA: string
  nomeB: string
  /** Valor PONDERADO do placar — é o número que aparece na tela. */
  placarA: number
  placarB: number
  placar: MatchScore
}

export interface Campeonato {
  torneio: LinhaTorneio
  equipes: LinhaEquipe[]
  jogadores: LinhaJogador[]
  elencos: Tables<'team_players'>[]
  participantes: Tables<'tournament_participants'>[]
  fases: LinhaFase[]
  partidas: PartidaComContexto[]
  classificacao: StandingsRow[]
  artilharia: ScorerRow[]
  estatisticasDeEquipe: Map<string, TeamStats>
  estatisticasDeJogador: Map<string, PlayerStats>
}

/** Estados em que a partida está acontecendo agora. */
export const STATUS_AO_VIVO = ['LIVE', 'PAUSED', 'GOLDEN_GOAL'] as const

export function estaAoVivo(p: { status: LinhaPartida['status'] }): boolean {
  return (STATUS_AO_VIVO as readonly string[]).includes(p.status)
}

export const ROTULO_STATUS_TORNEIO: Record<LinhaTorneio['status'], string> = {
  CONFIGURACAO: 'Inscrições abertas',
  AGUARDANDO_INICIO: 'Aguardando início',
  EM_ANDAMENTO: 'Em andamento',
  ENCERRADO: 'Encerrado',
}

export const ROTULO_STATUS_PARTIDA: Record<LinhaPartida['status'], string> = {
  SCHEDULED: 'A jogar',
  LIVE: 'Ao vivo',
  PAUSED: 'Pausada',
  GOLDEN_GOAL: 'Gol de ouro',
  FINISHED: 'Encerrada',
}

/** Mensagem legível para um erro vindo do PostgREST ou de uma RPC. */
export function descreverErro(erro: { message: string } | null | undefined): string | null {
  if (erro === null || erro === undefined) return null
  const bruto = erro.message
  // As RPCs levantam exceções já em português; o PostgREST prefixa a mensagem.
  const limpo = bruto.replace(/^.*?(?:violates|error:)\s*/i, '').trim()
  return limpo === '' ? bruto : limpo
}

interface Cru {
  torneio: LinhaTorneio
  equipes: LinhaEquipe[]
  fases: LinhaFase[]
  partidas: LinhaPartida[]
  elencos: Tables<'team_players'>[]
  participantes: Tables<'tournament_participants'>[]
  escalacoes: Tables<'match_lineups'>[]
  eventos: Tables<'match_events'>[]
  jogadores: LinhaJogador[]
}

/** Busca todas as linhas de um torneio. Retorna `null` se ele não existe. */
export async function buscarCru(tournamentId: string): Promise<Cru | null> {
  const [t, e, f, m, tp, part] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', tournamentId).maybeSingle(),
    supabase.from('teams').select('*').eq('tournament_id', tournamentId).order('nome'),
    supabase.from('phases').select('*').eq('tournament_id', tournamentId).order('ordem'),
    supabase.from('matches').select('*').eq('tournament_id', tournamentId).order('ordem'),
    supabase.from('team_players').select('*').eq('tournament_id', tournamentId),
    supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId),
  ])

  if (t.data === null) return null

  const partidas = m.data ?? []
  const idsPartida = partidas.map((p) => p.id)

  // `.in([])` no PostgREST vira uma consulta que não filtra nada; sem partida,
  // não há o que buscar.
  const [ml, ev] = await Promise.all([
    idsPartida.length === 0
      ? Promise.resolve({ data: [] as Tables<'match_lineups'>[] })
      : supabase.from('match_lineups').select('*').in('match_id', idsPartida),
    idsPartida.length === 0
      ? Promise.resolve({ data: [] as Tables<'match_events'>[] })
      : supabase.from('match_events').select('*').in('match_id', idsPartida).order('seq'),
  ])

  const elencos = tp.data ?? []
  const participantes = part.data ?? []
  const escalacoes = ml.data ?? []

  const idsJogador = [
    ...new Set([
      ...elencos.map((l) => l.player_id),
      ...participantes.map((l) => l.player_id),
      ...escalacoes.map((l) => l.player_id),
    ]),
  ]

  const jog =
    idsJogador.length === 0
      ? { data: [] as LinhaJogador[] }
      : await supabase.from('players').select('*').in('id', idsJogador).order('nome')

  return {
    torneio: t.data,
    equipes: e.data ?? [],
    fases: f.data ?? [],
    partidas,
    elencos,
    participantes,
    escalacoes,
    eventos: ev.data ?? [],
    jogadores: jog.data ?? [],
  }
}

/** Converte as linhas em `MatchWithEvents`, a forma que o domínio agrega. */
export function paraDominio(cru: Cru): MatchWithEvents[] {
  return cru.partidas.map((linha) => ({
    id: linha.id,
    teamAId: linha.team_a_id,
    teamBId: linha.team_b_id,
    phaseKind: linha.phase_kind,
    status: linha.status,
    lineupA: cru.escalacoes
      .filter((l) => l.match_id === linha.id && l.team_id === linha.team_a_id)
      .map((l) => l.player_id),
    lineupB: cru.escalacoes
      .filter((l) => l.match_id === linha.id && l.team_id === linha.team_b_id)
      .map((l) => l.player_id),
    events: cru.eventos.filter((x) => x.match_id === linha.id).map(paraEventoDoDominio),
  }))
}

/** Aplica o domínio sobre as linhas e devolve o campeonato pronto para a tela. */
export function derivar(cru: Cru): Campeonato {
  const dominio = paraDominio(cru)
  const porId = new Map(dominio.map((d) => [d.id, d]))
  const equipePorId = new Map(cru.equipes.map((e) => [e.id, e]))
  const nomeEquipe = (id: string) => equipePorId.get(id)?.nome ?? '—'

  const partidas: PartidaComContexto[] = cru.partidas.map((linha) => {
    const d = porId.get(linha.id)
    const placar = computeMatchScore(linha.team_a_id, linha.team_b_id, d?.events ?? [])
    return {
      linha,
      equipeA: equipePorId.get(linha.team_a_id),
      equipeB: equipePorId.get(linha.team_b_id),
      nomeA: nomeEquipe(linha.team_a_id),
      nomeB: nomeEquipe(linha.team_b_id),
      placarA: placar.teamA.gf,
      placarB: placar.teamB.gf,
      placar,
    }
  })

  // Só quem disputa este torneio entra na artilharia dele.
  const idsNoTorneio = new Set([
    ...cru.elencos.map((l) => l.player_id),
    ...cru.participantes.map((l) => l.player_id),
  ])
  const jogadoresDoTorneio = cru.jogadores.filter((j) => idsNoTorneio.has(j.id))

  return {
    torneio: cru.torneio,
    equipes: cru.equipes,
    jogadores: cru.jogadores,
    elencos: cru.elencos,
    participantes: cru.participantes,
    fases: cru.fases,
    partidas,
    classificacao: computeStandings(
      cru.equipes.map((x) => ({
        id: x.id,
        name: x.nome,
        playerIds: cru.elencos.filter((l) => l.team_id === x.id).map((l) => l.player_id),
      })),
      dominio,
    ),
    artilharia: computeScorerRanking(
      jogadoresDoTorneio.map((j) => ({ id: j.id, name: j.nome })),
      dominio,
      {
        teamOf: (playerId) => {
          const vinculo = cru.elencos.find((l) => l.player_id === playerId)
          if (vinculo === undefined) return null
          return { id: vinculo.team_id, name: nomeEquipe(vinculo.team_id) }
        },
      },
    ),
    estatisticasDeEquipe: computeTeamStats(dominio),
    estatisticasDeJogador: computePlayerStats(dominio),
  }
}

export async function carregarCampeonato(tournamentId: string): Promise<Campeonato | null> {
  const cru = await buscarCru(tournamentId)
  return cru === null ? null : derivar(cru)
}
