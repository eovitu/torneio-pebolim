/**
 * Estado ao vivo de uma partida.
 *
 * O banco é a fonte de verdade: o placar é sempre recalculado a partir dos
 * eventos por `computeMatchScore`, nunca lido de um número guardado (§30).
 *
 * Realtime entrega as mudanças sem recarregar a página. Como conexão cai e
 * aba dorme, há duas redes de segurança (§53): ao voltar o foco e ao
 * reconectar o canal, tudo é buscado de novo — perder um evento significaria
 * placar errado, e placar errado é o pior defeito possível aqui.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { computeMatchScore } from '@pebolim/domain'
import type { MatchEvent, MatchScore } from '@pebolim/domain'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { paraEventoDoDominio } from './adaptadores'

export interface DadosPartida {
  partida: Tables<'matches'>
  equipeA: Tables<'teams'>
  equipeB: Tables<'teams'>
  escalacao: (Tables<'match_lineups'> & { jogador: Tables<'players'> })[]
  eventos: MatchEvent[]
  linhasDeEvento: Tables<'match_events'>[]
  placar: MatchScore
}

export function usePartida(matchId: string) {
  const [dados, setDados] = useState<DadosPartida | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const buscando = useRef(false)

  const buscar = useCallback(async () => {
    if (buscando.current) return
    buscando.current = true
    const [p, e, ev] = await Promise.all([
      supabase.from('matches').select('*').eq('id', matchId).maybeSingle(),
      supabase.from('match_lineups').select('*, jogador:players(*)').eq('match_id', matchId),
      supabase.from('match_events').select('*').eq('match_id', matchId).order('seq'),
    ])
    buscando.current = false

    if (p.error || p.data === null) {
      setErro(p.error?.message ?? 'Partida não encontrada.')
      setCarregando(false)
      return
    }

    const partida = p.data
    const { data: equipes, error: erroEquipes } = await supabase
      .from('teams')
      .select('*')
      .in('id', [partida.team_a_id, partida.team_b_id])

    if (erroEquipes || equipes === null) {
      setErro(erroEquipes?.message ?? 'Não foi possível carregar as equipes.')
      setCarregando(false)
      return
    }

    const equipeA = equipes.find((t) => t.id === partida.team_a_id)
    const equipeB = equipes.find((t) => t.id === partida.team_b_id)
    if (equipeA === undefined || equipeB === undefined) {
      setErro('Equipes da partida não encontradas.')
      setCarregando(false)
      return
    }

    const linhasDeEvento = ev.data ?? []
    const eventos = linhasDeEvento.map(paraEventoDoDominio)

    setDados({
      partida,
      equipeA,
      equipeB,
      escalacao: (e.data ?? []) as DadosPartida['escalacao'],
      eventos,
      linhasDeEvento,
      placar: computeMatchScore(partida.team_a_id, partida.team_b_id, eventos),
    })
    setErro(null)
    setCarregando(false)
  }, [matchId])

  useEffect(() => {
    void buscar()
  }, [buscar])

  // Realtime + reconexão.
  useEffect(() => {
    const canal = supabase
      .channel(`partida:${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` },
        () => void buscar(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        () => void buscar(),
      )
      .subscribe((estado) => {
        // Reassinar depois de uma queda pode ter deixado eventos para trás.
        if (estado === 'SUBSCRIBED') void buscar()
      })

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void buscar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('online', aoVoltar)

    return () => {
      void supabase.removeChannel(canal)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('online', aoVoltar)
    }
  }, [matchId, buscar])

  return { dados, carregando, erro, recarregar: buscar }
}
