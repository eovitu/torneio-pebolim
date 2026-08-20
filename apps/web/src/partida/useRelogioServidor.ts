/**
 * Correção do desvio entre o relógio do aparelho e o do servidor.
 *
 * O cronômetro é derivado de timestamps gravados pelo servidor, mas quem conta
 * os segundos na tela é o navegador. Se o celular do juiz estiver dois minutos
 * adiantado, o cronômetro mostraria 02:00 numa partida que acabou de começar —
 * e ninguém desconfiaria, porque o número corre normalmente.
 *
 * Aqui medimos o desvio uma vez e passamos a usar "agora" corrigido em todo
 * cálculo de tempo. Enquanto a medição não volta, `pronto` é falso e a tela
 * evita mostrar um tempo em que não dá para confiar.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useRelogioServidor() {
  const desvioMs = useRef(0)
  const [pronto, setPronto] = useState(false)

  const medir = useCallback(async () => {
    // Metade do tempo de ida e volta aproxima o atraso de rede de um lado só.
    const antes = Date.now()
    const { data, error } = await supabase.rpc('relogio_servidor')
    const depois = Date.now()
    if (error || typeof data !== 'string') {
      // Sem medição, seguimos com o relógio local: melhor um tempo aproximado
      // do que uma tela travada.
      setPronto(true)
      return
    }
    const meioCaminho = antes + (depois - antes) / 2
    desvioMs.current = Date.parse(data) - meioCaminho
    setPronto(true)
  }, [])

  useEffect(() => {
    void medir()
  }, [medir])

  /** "Agora" na régua do servidor. */
  const agora = useCallback(() => Date.now() + desvioMs.current, [])

  return { agora, pronto, remedir: medir, desvioMs: desvioMs.current }
}
