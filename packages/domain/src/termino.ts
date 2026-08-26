/**
 * Condição de término da partida, confirmada pelo proprietário em 26/08/2026.
 *
 * Existem duas, e o administrador escolhe qual vale:
 *
 *   - POR TEMPO — o padrão de sempre: 3 minutos de tempo regulamentar (§37);
 *   - POR GOLS — a partida acaba assim que uma equipe chega à meta de gols
 *     configurada, independente do cronômetro.
 *
 * A escolha é do TORNEIO, e cada partida pode sobrescrevê-la. Isso cobre os
 * dois casos reais sem obrigar o admin a repetir a configuração: ele define o
 * padrão do campeonato uma vez, e ajusta a exceção quando ela aparece.
 *
 * SOBRE QUAL PLACAR CONTA
 *
 * A meta é comparada com o PLACAR, que é o valor ponderado dos gols — gol de
 * goleiro vale 2. É o mesmo número que aparece no placar da tela, então
 * "termina com 3 gols" é o que qualquer um lendo o marcador entende. Uma
 * consequência disso: um gol de goleiro pode fechar a partida saltando de 2
 * para 4, e isso é proposital, não arredondamento.
 *
 * SOBRE EMPATE
 *
 * Terminar por gols não muda o §37. Se a fase é mata-mata e a partida por
 * algum motivo terminar empatada, o Gol de Ouro decide. Na prática a meta
 * nunca produz empate: quem chega nela primeiro está na frente.
 */

import { MATCH_DURATION_SECONDS } from './types.js'

export type CondicaoDeTermino = 'TEMPO' | 'GOLS'

export interface RegraDeTermino {
  condicao: CondicaoDeTermino
  /** Meta de gols. Só faz sentido — e só é exigida — quando a condição é GOLS. */
  golsParaVencer: number | null
}

/** O padrão do sistema: os 3 minutos regulamentares. */
export const REGRA_PADRAO: RegraDeTermino = { condicao: 'TEMPO', golsParaVencer: null }

/** Limites do que é uma meta de gols plausível numa partida de pebolim. */
export const META_MINIMA = 1
export const META_MAXIMA = 20

/**
 * A regra que de fato vale para uma partida: a dela, quando existe, senão a do
 * torneio, senão o padrão. `null` em qualquer nível significa "não escolhi,
 * herda de cima".
 */
export function regraEfetiva(
  daPartida: Partial<RegraDeTermino> | null,
  doTorneio: Partial<RegraDeTermino> | null,
): RegraDeTermino {
  const condicao = daPartida?.condicao ?? doTorneio?.condicao ?? REGRA_PADRAO.condicao
  if (condicao !== 'GOLS') return REGRA_PADRAO

  const meta = daPartida?.condicao === 'GOLS'
    ? (daPartida.golsParaVencer ?? doTorneio?.golsParaVencer ?? null)
    : (doTorneio?.golsParaVencer ?? null)

  // Condição por gols sem meta não é uma regra: é uma configuração pela metade.
  // Nesse caso a partida volta ao tempo, que sempre sabe terminar.
  if (meta === null) return REGRA_PADRAO
  return { condicao: 'GOLS', golsParaVencer: meta }
}

/** Uma meta de gols só é válida dentro dos limites, e inteira. */
export function metaValida(meta: number): boolean {
  return Number.isInteger(meta) && meta >= META_MINIMA && meta <= META_MAXIMA
}

/**
 * A partida deve terminar AGORA por ter batido a meta?
 *
 * Sempre `false` na condição por tempo: lá quem encerra é o cronômetro, e o
 * placar não tem opinião sobre isso.
 */
export function atingiuAMeta(regra: RegraDeTermino, placarA: number, placarB: number): boolean {
  if (regra.condicao !== 'GOLS' || regra.golsParaVencer === null) return false
  return placarA >= regra.golsParaVencer || placarB >= regra.golsParaVencer
}

/** Texto curto da regra, para cabeçalho de partida e tela de configuração. */
export function descreverTermino(regra: RegraDeTermino): string {
  if (regra.condicao === 'GOLS' && regra.golsParaVencer !== null) {
    return `Termina com ${regra.golsParaVencer} gols`
  }
  return `Termina em ${MATCH_DURATION_SECONDS / 60} minutos`
}
