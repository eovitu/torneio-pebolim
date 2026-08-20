/**
 * Hooks de leitura do produto.
 *
 * Todos seguem a mesma forma: `{ ...dados, carregando, erro, recarregar }`,
 * para que as telas tratem carregando/erro/vazio sempre do mesmo jeito (§20 do
 * redesign).
 *
 * Realtime só onde há motivo — lista de torneios e perfil não mudam sozinhos.
 * Onde ele existe, `sincronizado` diz honestamente se o canal está de pé: a
 * tela precisa poder avisar que parou de receber, em vez de fingir tempo real
 * (§13 do redesign).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { computePlayerStats } from '@pebolim/domain'
import type { MatchWithEvents, PlayerStats } from '@pebolim/domain'
import { emptyPlayerStats } from '@pebolim/domain'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { useAuth } from '../auth/useAuth'
import {
  buscarCru,
  derivar,
  descreverErro,
  estaAoVivo,
  paraDominio,
} from './campeonato'
import type { Campeonato, LinhaEquipe, LinhaJogador, LinhaPartida, LinhaTorneio } from './campeonato'

/** Assina mudanças de partida/evento e chama `aoMudar` quando algo acontece. */
function useCanalDePartidas(chave: string | null, aoMudar: () => void) {
  const [sincronizado, setSincronizado] = useState(false)
  const callback = useRef(aoMudar)
  callback.current = aoMudar

  useEffect(() => {
    if (chave === null) return
    const canal = supabase
      .channel(chave)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_events' }, () =>
        callback.current(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () =>
        callback.current(),
      )
      .subscribe((estado) => {
        const ok = estado === 'SUBSCRIBED'
        setSincronizado(ok)
        // Reassinar depois de uma queda pode ter deixado eventos para trás.
        if (ok) callback.current()
      })

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') callback.current()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('online', aoVoltar)

    return () => {
      void supabase.removeChannel(canal)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('online', aoVoltar)
      setSincronizado(false)
    }
  }, [chave])

  return sincronizado
}

// ---------------------------------------------------------------------------
// Lista de torneios
// ---------------------------------------------------------------------------

export interface TorneioListado {
  torneio: LinhaTorneio
  equipes: number
  participantes: number
  /** Ids dos jogadores inscritos — a tela usa para saber se você já entrou. */
  idsParticipantes: string[]
  partidas: number
  aoVivo: number
}

export function useTorneios() {
  const [itens, setItens] = useState<TorneioListado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const [t, e, p, m] = await Promise.all([
      supabase.from('tournaments').select('*').order('created_at', { ascending: false }),
      supabase.from('teams').select('id, tournament_id'),
      supabase.from('tournament_participants').select('tournament_id, player_id'),
      supabase.from('matches').select('id, tournament_id, status'),
    ])

    const falha = [t, e, p, m].find((r) => r.error)
    if (falha?.error !== undefined && falha.error !== null) {
      setErro(descreverErro(falha.error))
      setCarregando(false)
      return
    }

    const conta = <T extends { tournament_id: string }>(linhas: T[] | null) => {
      const mapa = new Map<string, T[]>()
      for (const l of linhas ?? []) {
        const atual = mapa.get(l.tournament_id)
        if (atual === undefined) mapa.set(l.tournament_id, [l])
        else atual.push(l)
      }
      return mapa
    }

    const porEquipe = conta(e.data)
    const porParticipante = conta(p.data)
    const porPartida = conta(m.data)

    setItens(
      (t.data ?? []).map((torneio) => {
        const partidas = porPartida.get(torneio.id) ?? []
        return {
          torneio,
          equipes: (porEquipe.get(torneio.id) ?? []).length,
          participantes: (porParticipante.get(torneio.id) ?? []).length,
          idsParticipantes: (porParticipante.get(torneio.id) ?? []).map((l) => l.player_id),
          partidas: partidas.length,
          aoVivo: partidas.filter(estaAoVivo).length,
        }
      }),
    )
    setErro(null)
    setCarregando(false)
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return { itens, carregando, erro, recarregar: carregar }
}

// ---------------------------------------------------------------------------
// Um campeonato inteiro, com realtime
// ---------------------------------------------------------------------------

export function useCampeonato(tournamentId: string | null, comRealtime = true) {
  const [campeonato, setCampeonato] = useState<Campeonato | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const buscando = useRef(false)

  const carregar = useCallback(async () => {
    if (tournamentId === null) {
      setCampeonato(null)
      setCarregando(false)
      return
    }
    // Uma rajada de eventos realtime não deve disparar buscas concorrentes.
    if (buscando.current) return
    buscando.current = true
    try {
      const cru = await buscarCru(tournamentId)
      if (cru === null) {
        setErro('Torneio não encontrado.')
        setCampeonato(null)
      } else {
        setCampeonato(derivar(cru))
        setErro(null)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o torneio.')
    } finally {
      buscando.current = false
      setCarregando(false)
    }
  }, [tournamentId])

  useEffect(() => {
    setCarregando(true)
    void carregar()
  }, [carregar])

  const sincronizado = useCanalDePartidas(
    comRealtime && tournamentId !== null ? `campeonato:${tournamentId}` : null,
    () => void carregar(),
  )

  return { campeonato, carregando, erro, recarregar: carregar, sincronizado }
}

// ---------------------------------------------------------------------------
// O jogador da pessoa logada
// ---------------------------------------------------------------------------

export function useMeuJogador() {
  const { user } = useAuth()
  const [jogador, setJogador] = useState<LinhaJogador | null>(null)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (user === null) {
      setJogador(null)
      setCarregando(false)
      return
    }
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('profile_id', user.id)
      .maybeSingle()
    setJogador(data)
    setCarregando(false)
  }, [user])

  useEffect(() => {
    setCarregando(true)
    void carregar()
  }, [carregar])

  return { jogador, carregando, recarregar: carregar }
}

// ---------------------------------------------------------------------------
// Painel da Home
// ---------------------------------------------------------------------------

export interface PartidaDoPainel {
  linha: LinhaPartida
  nomeA: string
  nomeB: string
  placarA: number
  placarB: number
  nomeTorneio: string
}

/**
 * Panorama geral: tudo o que a Home precisa saber em poucas consultas.
 *
 * A Home é um resumo de TODOS os torneios; o detalhamento de um campeonato
 * específico é a página do torneio. Por isso aqui carregamos as partidas ao
 * vivo e as próximas de qualquer torneio, e só o torneio em destaque recebe o
 * carregamento completo (tabela e artilharia).
 */
export function usePainel() {
  const [torneios, setTorneios] = useState<LinhaTorneio[]>([])
  const [equipes, setEquipes] = useState<LinhaEquipe[]>([])
  const [partidas, setPartidas] = useState<LinhaPartida[]>([])
  const [eventos, setEventos] = useState<Tables<'match_events'>[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const buscando = useRef(false)

  const carregar = useCallback(async () => {
    if (buscando.current) return
    buscando.current = true

    const [t, e, m] = await Promise.all([
      supabase.from('tournaments').select('*').order('created_at', { ascending: false }),
      supabase.from('teams').select('*'),
      supabase.from('matches').select('*').order('ordem'),
    ])

    const relevantes = (m.data ?? []).filter(
      (p) => estaAoVivo(p) || p.status === 'SCHEDULED' || p.status === 'FINISHED',
    )
    // Só os eventos das partidas que a Home mostra — o placar do card sai daí.
    // As que estão acontecendo entram SEMPRE: cortar uma delas por limite de
    // lista faria o placar ao vivo aparecer como 0 × 0.
    const idsComPlacar = [
      ...new Set([
        ...relevantes.filter(estaAoVivo).map((p) => p.id),
        ...relevantes
          .filter((p) => p.status === 'FINISHED')
          .slice(-30)
          .map((p) => p.id),
      ]),
    ]

    const ev =
      idsComPlacar.length === 0
        ? { data: [] as Tables<'match_events'>[] }
        : await supabase.from('match_events').select('*').in('match_id', idsComPlacar).order('seq')

    const falha = [t, e, m].find((r) => r.error)
    setErro(falha?.error !== undefined && falha.error !== null ? descreverErro(falha.error) : null)
    setTorneios(t.data ?? [])
    setEquipes(e.data ?? [])
    setPartidas(m.data ?? [])
    setEventos(ev.data ?? [])
    setCarregando(false)
    buscando.current = false
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const sincronizado = useCanalDePartidas('painel', () => void carregar())

  const derivado = useMemo(() => {
    const nomeEquipe = new Map(equipes.map((x) => [x.id, x.nome]))
    const nomeTorneio = new Map(torneios.map((x) => [x.id, x.nome]))

    const comPlacar = (linha: LinhaPartida): PartidaDoPainel => {
      const doJogo = eventos.filter((x) => x.match_id === linha.id)
      const removidos = new Set(
        doJogo.filter((x) => x.type === 'GOAL_REMOVED').map((x) => x.removed_event_id),
      )
      let a = 0
      let b = 0
      for (const x of doJogo) {
        if (removidos.has(x.id)) continue
        if (x.type !== 'NORMAL_GOAL' && x.type !== 'KEEPER_GOAL' && x.type !== 'OWN_GOAL') continue
        // Gol contra credita o adversário de quem cometeu.
        const paraA =
          x.type === 'OWN_GOAL' ? x.team_id !== linha.team_a_id : x.team_id === linha.team_a_id
        const valor = x.goal_value ?? 1
        if (paraA) a += valor
        else b += valor
      }
      return {
        linha,
        nomeA: nomeEquipe.get(linha.team_a_id) ?? '—',
        nomeB: nomeEquipe.get(linha.team_b_id) ?? '—',
        placarA: a,
        placarB: b,
        nomeTorneio: nomeTorneio.get(linha.tournament_id) ?? '',
      }
    }

    const aoVivo = partidas.filter(estaAoVivo).map(comPlacar)
    const proximas = partidas.filter((p) => p.status === 'SCHEDULED').slice(0, 6).map(comPlacar)
    const recentes = partidas
      .filter((p) => p.status === 'FINISHED')
      .slice(-5)
      .reverse()
      .map(comPlacar)

    // Torneio em destaque: o que está acontecendo agora tem prioridade.
    const emDestaque =
      torneios.find((t) => t.status === 'EM_ANDAMENTO') ??
      torneios.find((t) => t.status === 'AGUARDANDO_INICIO') ??
      torneios.find((t) => t.status === 'CONFIGURACAO') ??
      torneios[0] ??
      null

    return { aoVivo, proximas, recentes, emDestaque }
  }, [partidas, equipes, torneios, eventos])

  return { torneios, ...derivado, carregando, erro, recarregar: carregar, sincronizado }
}

// ---------------------------------------------------------------------------
// Times e partidas da pessoa
// ---------------------------------------------------------------------------

export interface MeuTime {
  equipe: LinhaEquipe
  torneio: LinhaTorneio
  companheiros: LinhaJogador[]
}

/** Times em que a pessoa joga, com o torneio de cada um. */
export function useMeusTimes() {
  const { jogador, carregando: carregandoJogador } = useMeuJogador()
  const [times, setTimes] = useState<MeuTime[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (jogador === null) {
      setTimes([])
      setCarregando(false)
      return
    }
    const { data: meus } = await supabase
      .from('team_players')
      .select('team_id, tournament_id')
      .eq('player_id', jogador.id)

    const idsEquipe = (meus ?? []).map((l) => l.team_id)
    if (idsEquipe.length === 0) {
      setTimes([])
      setCarregando(false)
      return
    }

    const [e, t, elencos] = await Promise.all([
      supabase.from('teams').select('*').in('id', idsEquipe),
      supabase
        .from('tournaments')
        .select('*')
        .in('id', [...new Set((meus ?? []).map((l) => l.tournament_id))]),
      supabase.from('team_players').select('team_id, player_id').in('team_id', idsEquipe),
    ])

    const idsJogador = [...new Set((elencos.data ?? []).map((l) => l.player_id))]
    const { data: jogadores } = await supabase.from('players').select('*').in('id', idsJogador)
    const porId = new Map((jogadores ?? []).map((j) => [j.id, j]))
    const torneioPorId = new Map((t.data ?? []).map((x) => [x.id, x]))

    setTimes(
      (e.data ?? []).flatMap((equipe) => {
        const torneio = torneioPorId.get(equipe.tournament_id)
        if (torneio === undefined) return []
        return [
          {
            equipe,
            torneio,
            companheiros: (elencos.data ?? [])
              .filter((l) => l.team_id === equipe.id)
              .flatMap((l) => {
                const j = porId.get(l.player_id)
                return j === undefined ? [] : [j]
              }),
          },
        ]
      }),
    )
    setCarregando(false)
  }, [jogador])

  useEffect(() => {
    if (carregandoJogador) return
    setCarregando(true)
    void carregar()
  }, [carregar, carregandoJogador])

  return { jogador, times, carregando: carregando || carregandoJogador, recarregar: carregar }
}

/**
 * Partidas dos torneios em que a pessoa participa.
 *
 * Mostrar só os torneios dela é decisão de interface: quem opera uma partida é
 * decidido pelo servidor em `is_operador_da_partida`, não por esta lista (§45).
 */
export function useMinhasPartidas() {
  const { jogador, carregando: carregandoJogador } = useMeuJogador()
  const [partidas, setPartidas] = useState<PartidaDoPainel[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (jogador === null) {
      setPartidas([])
      setCarregando(false)
      return
    }

    const { data: participacoes } = await supabase
      .from('tournament_participants')
      .select('tournament_id')
      .eq('player_id', jogador.id)

    const ids = [...new Set((participacoes ?? []).map((l) => l.tournament_id))]
    if (ids.length === 0) {
      setPartidas([])
      setCarregando(false)
      return
    }

    const [m, e, t] = await Promise.all([
      supabase.from('matches').select('*').in('tournament_id', ids).order('ordem'),
      supabase.from('teams').select('id, nome').in('tournament_id', ids),
      supabase.from('tournaments').select('id, nome').in('id', ids),
    ])

    const linhas = m.data ?? []
    const idsComPlacar = linhas.filter((p) => p.status !== 'SCHEDULED').map((p) => p.id)
    const ev =
      idsComPlacar.length === 0
        ? { data: [] as Tables<'match_events'>[] }
        : await supabase.from('match_events').select('*').in('match_id', idsComPlacar).order('seq')

    const nomeEquipe = new Map((e.data ?? []).map((x) => [x.id, x.nome]))
    const nomeTorneio = new Map((t.data ?? []).map((x) => [x.id, x.nome]))
    const eventos = ev.data ?? []

    setPartidas(
      linhas.map((linha) => {
        const doJogo = eventos.filter((x) => x.match_id === linha.id)
        const removidos = new Set(
          doJogo.filter((x) => x.type === 'GOAL_REMOVED').map((x) => x.removed_event_id),
        )
        let a = 0
        let b = 0
        for (const x of doJogo) {
          if (removidos.has(x.id)) continue
          if (x.type !== 'NORMAL_GOAL' && x.type !== 'KEEPER_GOAL' && x.type !== 'OWN_GOAL') continue
          const paraA =
            x.type === 'OWN_GOAL' ? x.team_id !== linha.team_a_id : x.team_id === linha.team_a_id
          const valor = x.goal_value ?? 1
          if (paraA) a += valor
          else b += valor
        }
        return {
          linha,
          nomeA: nomeEquipe.get(linha.team_a_id) ?? '—',
          nomeB: nomeEquipe.get(linha.team_b_id) ?? '—',
          placarA: a,
          placarB: b,
          nomeTorneio: nomeTorneio.get(linha.tournament_id) ?? '',
        }
      }),
    )
    setCarregando(false)
  }, [jogador])

  useEffect(() => {
    if (carregandoJogador) return
    setCarregando(true)
    void carregar()
  }, [carregar, carregandoJogador])

  const sincronizado = useCanalDePartidas('minhas-partidas', () => void carregar())

  return {
    jogador,
    partidas,
    carregando: carregando || carregandoJogador,
    recarregar: carregar,
    sincronizado,
  }
}

// ---------------------------------------------------------------------------
// Perfil público de um jogador
// ---------------------------------------------------------------------------

export interface PerfilDeJogador {
  jogador: LinhaJogador
  estatisticas: PlayerStats
  times: { equipe: LinhaEquipe; torneio: LinhaTorneio }[]
  partidas: PartidaDoPainel[]
}

/**
 * Perfil público. Lê de `players`, que é público por RLS — `profiles` continua
 * privado e nada dele aparece aqui (§45).
 */
export function useJogadorPublico(playerId: string | null) {
  const [perfil, setPerfil] = useState<PerfilDeJogador | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (playerId === null) return
    setCarregando(true)

    const { data: jogador } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .maybeSingle()

    if (jogador === null) {
      setErro('Jogador não encontrado.')
      setPerfil(null)
      setCarregando(false)
      return
    }

    const { data: vinculos } = await supabase
      .from('team_players')
      .select('team_id, tournament_id')
      .eq('player_id', playerId)

    const idsTorneio = [...new Set((vinculos ?? []).map((l) => l.tournament_id))]
    if (idsTorneio.length === 0) {
      setPerfil({
        jogador,
        estatisticas: emptyPlayerStats(jogador.id),
        times: [],
        partidas: [],
      })
      setErro(null)
      setCarregando(false)
      return
    }

    // O histórico de um jogador cruza torneios; cada um é carregado inteiro
    // porque as estatísticas dele dependem de todas as partidas que disputou.
    const crus = await Promise.all(idsTorneio.map((id) => buscarCru(id)))
    const validos = crus.flatMap((c) => (c === null ? [] : [c]))

    const dominio: MatchWithEvents[] = validos.flatMap(paraDominio)
    const estatisticas = computePlayerStats(dominio).get(jogador.id) ?? emptyPlayerStats(jogador.id)

    const equipePorId = new Map(validos.flatMap((c) => c.equipes).map((e) => [e.id, e]))
    const torneioPorId = new Map(validos.map((c) => [c.torneio.id, c.torneio]))

    const times = (vinculos ?? []).flatMap((l) => {
      const equipe = equipePorId.get(l.team_id)
      const torneio = torneioPorId.get(l.tournament_id)
      return equipe === undefined || torneio === undefined ? [] : [{ equipe, torneio }]
    })

    const minhasEquipes = new Set(times.map((x) => x.equipe.id))
    const partidas: PartidaDoPainel[] = validos
      .flatMap((c) => derivar(c).partidas.map((p) => ({ p, torneio: c.torneio })))
      .filter(({ p }) => minhasEquipes.has(p.linha.team_a_id) || minhasEquipes.has(p.linha.team_b_id))
      .map(({ p, torneio }) => ({
        linha: p.linha,
        nomeA: p.nomeA,
        nomeB: p.nomeB,
        placarA: p.placarA,
        placarB: p.placarB,
        nomeTorneio: torneio.nome,
      }))

    setPerfil({ jogador, estatisticas, times, partidas })
    setErro(null)
    setCarregando(false)
  }, [playerId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return { perfil, carregando, erro, recarregar: carregar }
}
