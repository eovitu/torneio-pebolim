/**
 * Sugestão de rodízio depois que a partida encerra.
 *
 * Quem calcula é o banco (`rodizio_sugerido`), que espelha `planejarRodizio` do
 * domínio e conhece o histórico de quem já ficou sozinho. Esta camada só busca
 * a sugestão e a devolve para a tela.
 *
 * A busca só acontece quando a partida está encerrada e quem está olhando pode
 * decidir — não faz sentido consultar para um espectador.
 */

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { descreverErro } from '../dados/campeonato'

export interface SugestaoDeRodizio {
  vai_player_id: string
  vai_nome: string
  vai_sozinho: number
  fica_player_id: string
  fica_nome: string
  fica_sozinho: number
  de_team_id: string
  de_equipe: string
  para_team_id: string
  para_equipe: string
  solitario_nome: string
}

export function useRodizio(matchId: string, habilitado: boolean) {
  const [sugestao, setSugestao] = useState<SugestaoDeRodizio | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const buscar = useCallback(async () => {
    if (!habilitado) {
      setSugestao(null)
      return
    }
    setCarregando(true)
    const { data, error } = await supabase.rpc('rodizio_sugerido', { p_match_id: matchId })
    setCarregando(false)
    if (error !== null) {
      setErro(descreverErro(error))
      return
    }
    // A função devolve zero ou uma linha; zero significa "não há rodízio".
    const linhas = (data ?? []) as SugestaoDeRodizio[]
    setSugestao(linhas[0] ?? null)
    setErro(null)
  }, [matchId, habilitado])

  useEffect(() => {
    void buscar()
  }, [buscar])

  /** `aceitar = false` mantém a composição e para de perguntar. */
  const resolver = useCallback(
    async (aceitar: boolean) => {
      setErro(null)
      setOcupado(true)
      const { error } = await supabase.rpc('resolver_rodizio', {
        p_match_id: matchId,
        p_aceitar: aceitar,
      })
      setOcupado(false)
      if (error !== null) {
        setErro(descreverErro(error))
        return false
      }
      setSugestao(null)
      return true
    },
    [matchId],
  )

  return { sugestao, carregando, erro, ocupado, resolver, recarregar: buscar }
}
