/**
 * Tradução de estado para tom visual.
 *
 * Fica fora do arquivo de componentes porque o Fast Refresh do Vite exige que
 * um módulo de componente exporte apenas componentes.
 *
 * O tom é só cor: toda etiqueta que os usa carrega também o texto do estado,
 * porque nenhuma informação pode depender só de cor (§17 do redesign).
 */

import type { TomBadge } from '../ui/Etiqueta'
import type { LinhaPartida, LinhaTorneio } from '../dados/campeonato'

export function tomDoStatusDaPartida(status: LinhaPartida['status']): TomBadge {
  if (status === 'LIVE') return 'aoVivo'
  if (status === 'GOLDEN_GOAL') return 'ouro'
  if (status === 'PAUSED') return 'aviso'
  if (status === 'FINISHED') return 'neutro'
  return 'marca'
}

export function tomDoStatusDoTorneio(status: LinhaTorneio['status']): TomBadge {
  if (status === 'EM_ANDAMENTO') return 'sucesso'
  if (status === 'CONFIGURACAO') return 'acento'
  if (status === 'AGUARDANDO_INICIO') return 'info'
  return 'neutro'
}
