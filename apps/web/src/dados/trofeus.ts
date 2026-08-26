/**
 * Formas dos troféus do pódio, separadas do componente que os desenha.
 *
 * Fica aqui, e não em `components/Trofeus.tsx`, porque tipo e normalização são
 * dados, não componente — e um módulo que exporta as duas coisas quebra o fast
 * refresh do Vite.
 */

export type PosicaoDeTrofeu = 'CAMPEAO' | 'VICE' | 'TERCEIRO'

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
}

export const METAL_TROFEU: Record<PosicaoDeTrofeu, string> = {
  CAMPEAO: 'Ouro',
  VICE: 'Prata',
  TERCEIRO: 'Bronze',
}

/** Nome de cada skin como o administrador a vê ao escolher. */
export const ROTULO_SKIN: Record<SkinDeTrofeu, string> = {
  CLASSICO: 'Clássico — metais tradicionais',
  NEON: 'Neon — saturado e brilhante',
  RETRO: 'Retrô — metais foscos',
  BOTECO: 'Boteco — quente e cru',
}
