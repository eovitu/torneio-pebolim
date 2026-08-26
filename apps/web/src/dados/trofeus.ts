/**
 * Formas dos troféus do pódio, separadas do componente que os desenha.
 *
 * Fica aqui, e não em `components/Trofeus.tsx`, porque tipo e normalização são
 * dados, não componente — e um módulo que exporta as duas coisas quebra o fast
 * refresh do Vite.
 */

import { supabase } from '../lib/supabase'

/**
 * As três primeiras são posições de pódio, decididas por confronto. ARTILHEIRO
 * não é posição: é um prêmio individual, decidido pela soma do torneio inteiro
 * — e por isso só sai quando o torneio é encerrado.
 */
export type PosicaoDeTrofeu = 'CAMPEAO' | 'VICE' | 'TERCEIRO' | 'ARTILHEIRO'

/** Posições de pódio, na ordem do degrau. Artilheiro não entra: não é degrau. */
export const PODIO = ['CAMPEAO', 'VICE', 'TERCEIRO'] as const

/** As skins que o administrador pode escolher por torneio. */
export const SKINS = ['CLASSICO', 'NEON', 'RETRO', 'BOTECO'] as const
export type SkinDeTrofeu = (typeof SKINS)[number]

export interface TrofeuExibido {
  id: string
  posicao: PosicaoDeTrofeu
  skin: SkinDeTrofeu
  nomeDoTorneio: string
  nomeDaEquipe: string
}

/**
 * O banco guarda a skin como texto com CHECK, não como enum: acrescentar um
 * desenho novo é migração de uma linha só. Aqui ela vira união fechada, e uma
 * skin desconhecida cai no clássico em vez de quebrar o perfil.
 */
export function paraSkin(valor: string): SkinDeTrofeu {
  return (SKINS as readonly string[]).includes(valor) ? (valor as SkinDeTrofeu) : 'CLASSICO'
}

/** Rótulo por extenso — a posição nunca é comunicada só pela cor (§17). */
export const ROTULO_TROFEU: Record<PosicaoDeTrofeu, string> = {
  CAMPEAO: 'Campeão',
  VICE: 'Vice-campeão',
  TERCEIRO: '3º lugar',
  ARTILHEIRO: 'Artilheiro',
}

export const METAL_TROFEU: Record<PosicaoDeTrofeu, string> = {
  CAMPEAO: 'Ouro',
  VICE: 'Prata',
  TERCEIRO: 'Bronze',
  ARTILHEIRO: 'Chuteira de ouro',
}

/** Nome de cada skin como o administrador a vê ao escolher. */
export const ROTULO_SKIN: Record<SkinDeTrofeu, string> = {
  CLASSICO: 'Clássico — metais tradicionais',
  NEON: 'Neon — saturado e brilhante',
  RETRO: 'Retrô — metais foscos',
  BOTECO: 'Boteco — quente e cru',
}

/** Ordem da estante: pódio pelo degrau, e o artilheiro por último — outra categoria. */
const PESO_TROFEU: Record<PosicaoDeTrofeu, number> = {
  CAMPEAO: 0,
  VICE: 1,
  TERCEIRO: 2,
  ARTILHEIRO: 3,
}

/**
 * A conquista mais alta de uma lista, para resumir num distintivo só.
 * Presume lista não vazia — quem chama já checou.
 */
export function melhorTrofeu(lista: readonly TrofeuExibido[]): PosicaoDeTrofeu {
  return [...lista].sort((a, b) => PESO_TROFEU[a.posicao] - PESO_TROFEU[b.posicao])[0]!.posicao
}

/**
 * Troféus conquistados por uma equipe.
 *
 * A tabela guarda UMA LINHA POR JOGADOR — é assim que o mesmo troféu chega ao
 * perfil de cada um deles. Uma equipe de dois jogadores tem, portanto, duas
 * linhas do mesmo bronze.
 *
 * Mas a equipe ganhou UM bronze, não dois: a conquista é dela, e as linhas por
 * jogador são a forma de distribuí-la. Por isso as linhas são agrupadas por
 * torneio e posição antes de virarem cartões. Sem isso a página mostra o mesmo
 * troféu repetido, uma vez por integrante do elenco.
 */
export async function buscarTrofeusDaEquipe(
  teamId: string,
): Promise<TrofeuExibido[]> {
  const { data } = await supabase
    .from('trofeus')
    .select('id, posicao, tournament_id, team_id, tournaments(nome, trofeu_skin), teams(nome)')
    .eq('team_id', teamId)

  const linhas = data ?? []

  // Uma conquista por torneio e posição. A chave não inclui o jogador
  // justamente porque é ele que se repete.
  const porConquista = new Map<string, TrofeuExibido>()
  for (const l of linhas) {
    const torneio = l.tournaments
    const equipe = l.teams
    // Sem o nome do torneio o troféu não diz de onde veio, que é metade do que
    // ele comunica.
    if (torneio === null || equipe === null) continue

    const chave = `${l.tournament_id}:${l.posicao}`
    if (porConquista.has(chave)) continue
    porConquista.set(chave, {
      id: chave,
      posicao: l.posicao,
      skin: paraSkin(torneio.trofeu_skin),
      nomeDoTorneio: torneio.nome,
      nomeDaEquipe: equipe.nome,
    })
  }

  return [...porConquista.values()]
}
