/**
 * Formação das equipes a partir do número de participantes.
 *
 * Regra definida pelo proprietário em 20/08/2026, substituindo o formato de
 * número fixo: o torneio se divide pela quantidade de gente disponível, e não
 * por um total travado na criação.
 *
 *   - no máximo 2 pessoas por equipe;
 *   - só vale formar duplas se sobrarem ao menos DUAS duplas — com menos que
 *     isso, uma dupla contra um sozinho seria o campeonato inteiro, então
 *     todo mundo joga sozinho;
 *   - quando o número é ímpar e as duplas fecham, sobra uma equipe de 1, e
 *     isso é permitido.
 *
 * Exemplos oficiais dados pelo proprietário:
 *
 *   2 → [A] [B]                    3 → [A] [B] [C]
 *   4 → [A+B] [C+D]                5 → [A+B] [C+D] [E]
 *   6 → [A+B] [C+D] [E+F]          7 → [A+B] [C+D] [E+F] [G]
 *
 * Este módulo é a fonte de verdade da regra. O banco espelha o mesmo cálculo
 * dentro de `formar_equipes`, porque a interface não pode ser a única a saber
 * a regra (§45), e a interface o usa para mostrar a prévia antes do sorteio.
 */

/** Máximo de pessoas por equipe. */
export const MAX_JOGADORES_POR_EQUIPE = 2

/** Mínimo de participantes para existir um confronto. */
export const MIN_PARTICIPANTES = 2

/** Mínimo de duplas para que valha a pena formar duplas. */
const MINIMO_DE_DUPLAS = 2

export interface ComposicaoDeEquipes {
  /** Quantas equipes de 2 pessoas. */
  duplas: number
  /** Quantas equipes de 1 pessoa. */
  solos: number
  /** Total de equipes. */
  equipes: number
  /** Tamanho de cada equipe, na ordem em que serão criadas. */
  tamanhos: number[]
}

/**
 * Divide `totalDeJogadores` pessoas em equipes.
 *
 * Lança quando não há gente suficiente para um confronto — dois times são o
 * mínimo para existir partida.
 */
export function comporEquipes(totalDeJogadores: number): ComposicaoDeEquipes {
  if (!Number.isInteger(totalDeJogadores)) {
    throw new Error('o número de participantes precisa ser inteiro')
  }
  if (totalDeJogadores < MIN_PARTICIPANTES) {
    throw new Error(`são necessários ao menos ${MIN_PARTICIPANTES} participantes`)
  }

  const duplasPossiveis = Math.floor(totalDeJogadores / MAX_JOGADORES_POR_EQUIPE)

  // Menos de duas duplas significa que o campeonato inteiro seria uma dupla
  // contra um sozinho. Nesse caso ninguém joga em dupla.
  if (duplasPossiveis < MINIMO_DE_DUPLAS) {
    return {
      duplas: 0,
      solos: totalDeJogadores,
      equipes: totalDeJogadores,
      tamanhos: Array.from({ length: totalDeJogadores }, () => 1),
    }
  }

  const solos = totalDeJogadores % MAX_JOGADORES_POR_EQUIPE
  return {
    duplas: duplasPossiveis,
    solos,
    equipes: duplasPossiveis + solos,
    tamanhos: [
      ...Array.from({ length: duplasPossiveis }, () => MAX_JOGADORES_POR_EQUIPE),
      ...Array.from({ length: solos }, () => 1),
    ],
  }
}

/** Frase curta descrevendo a composição, para a interface. */
export function descreverComposicao(c: ComposicaoDeEquipes): string {
  const partes: string[] = []
  if (c.duplas > 0) partes.push(c.duplas === 1 ? '1 dupla' : `${c.duplas} duplas`)
  if (c.solos > 0) {
    partes.push(c.solos === 1 ? '1 jogando sozinho' : `${c.solos} jogando sozinhos`)
  }
  return `${c.equipes} ${c.equipes === 1 ? 'equipe' : 'equipes'} — ${partes.join(' e ')}`
}

/** Uma equipe com uma pessoa só enfrenta duplas — situação prevista e válida. */
export function temEquipeSozinha(c: ComposicaoDeEquipes): boolean {
  return c.solos > 0 && c.duplas > 0
}
