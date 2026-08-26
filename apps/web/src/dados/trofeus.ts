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
 * Uma equipe existe dentro de um torneio só, então isto devolve no máximo um
 * troféu — mas a forma é lista para casar com o componente que desenha, e para
 * não precisar mudar caso um dia uma equipe atravesse torneios.
 */
export async function buscarTrofeusDaEquipe(
  teamId: string,
): Promise<TrofeuExibido[]> {
  const { data } = await supabase
    .from('trofeus')
    .select('id, posicao, tournament_id, team_id, tournaments(nome, trofeu_skin), teams(nome)')
    .eq('team_id', teamId)

  const linhas = data ?? []
  // Uma linha só é útil quando o torneio e a equipe vieram junto: sem o nome do
  // torneio o troféu não diz de onde veio, que é metade do que ele comunica.
  return linhas.flatMap((l) => {
    const torneio = l.tournaments
    const equipe = l.teams
    if (torneio === null || equipe === null) return []
    return [
      {
        id: l.id,
        posicao: l.posicao,
        skin: paraSkin(torneio.trofeu_skin),
        nomeDoTorneio: torneio.nome,
        nomeDaEquipe: equipe.nome,
      },
    ]
  })
}
