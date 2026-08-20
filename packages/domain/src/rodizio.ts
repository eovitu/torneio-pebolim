/**
 * Rodízio de quem joga sozinho.
 *
 * Regra definida pelo proprietário em 20/08/2026. Quando o número de
 * participantes é ímpar, uma equipe fica com uma pessoa só — e ninguém pode
 * ficar sozinho o campeonato inteiro. Depois de cada partida encerrada, a
 * equipe que PERDEU empresta um jogador para acompanhar quem está sozinho, e
 * quem sobrou na perdedora passa a ser o sozinho da vez.
 *
 *   Antes:   [A+B]  [C+D]  [E]        A+B perde para C+D
 *   Depois:  [A]    [C+D]  [E+B]      B foi para o E, A ficou sozinho
 *
 * Quem vai é quem JÁ FICOU MAIS VEZES SOZINHO — ele escapa do solo e a vez
 * passa para o companheiro. É isso que cumpre "ninguém fica sempre sozinho".
 * O desempate é por quem menos vezes formou dupla com o solitário atual, para
 * não repetir sempre o mesmo par por favorecimento.
 *
 * Casos em que NADA acontece:
 *   - não existe equipe de uma pessoa só;
 *   - a partida terminou empatada, então não há perdedora;
 *   - quem perdeu foi a própria equipe de um — não há quem emprestar;
 *   - a perdedora não tem duas pessoas.
 *
 * Este módulo é puro: recebe os números já contados e devolve a decisão. Quem
 * conta as partidas e quem aplica a troca é a camada de banco.
 */

export interface CandidatoAoRodizio {
  playerId: string
  nome: string
  /** Partidas encerradas que este jogador disputou como equipe de uma pessoa. */
  partidasSozinho: number
  /** Partidas encerradas em que jogou na mesma equipe do solitário atual. */
  vezesComOSolitario: number
}

export interface EquipeNoRodizio {
  teamId: string
  nome: string
  jogadores: CandidatoAoRodizio[]
}

export interface PlanoDeRodizio {
  /** Sai da perdedora e passa a acompanhar quem estava sozinho. */
  vai: CandidatoAoRodizio
  /** Fica na perdedora e passa a ser o sozinho da vez. */
  fica: CandidatoAoRodizio
  deEquipeId: string
  deEquipeNome: string
  paraEquipeId: string
  paraEquipeNome: string
  /** Quem estava sozinho e agora ganha companhia. */
  solitario: CandidatoAoRodizio
}

/**
 * Ordena os candidatos do mais ao menos indicado para acompanhar o solitário.
 *
 * Exportada para que a interface possa explicar a escolha, e não só mostrá-la.
 */
export function ordenarCandidatos(
  candidatos: readonly CandidatoAoRodizio[],
): CandidatoAoRodizio[] {
  return candidatos.slice().sort(
    (a, b) =>
      // 1. quem mais penou sozinho tem prioridade para ganhar parceiro
      b.partidasSozinho - a.partidasSozinho ||
      // 2. entre iguais, quem menos jogou com este solitário — evita par fixo
      a.vezesComOSolitario - b.vezesComOSolitario ||
      // 3. desempate técnico, só para a decisão ser reproduzível
      a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}

export interface EntradaDoRodizio {
  /** Equipe que perdeu a partida. `null` em caso de empate. */
  perdedora: EquipeNoRodizio | null
  /** Equipe com uma pessoa só no torneio. `null` quando não existe. */
  solitaria: EquipeNoRodizio | null
}

/**
 * Decide a recomposição depois de uma partida encerrada.
 * Devolve `null` quando não há rodízio a fazer.
 */
export function planejarRodizio({ perdedora, solitaria }: EntradaDoRodizio): PlanoDeRodizio | null {
  if (solitaria === null || perdedora === null) return null

  // Quem perdeu foi o próprio solitário: não há ninguém para emprestar, e a
  // composição segue igual até uma dupla perder.
  if (perdedora.teamId === solitaria.teamId) return null

  // A equipe de um só tem exatamente uma pessoa; se não tem, não é a solitária.
  const solitario = solitaria.jogadores[0]
  if (solitario === undefined || solitaria.jogadores.length !== 1) return null

  // Emprestar exige ter dois. Uma perdedora de um só não empresta ninguém.
  if (perdedora.jogadores.length < 2) return null

  const ordenados = ordenarCandidatos(perdedora.jogadores)
  const vai = ordenados[0]
  const fica = ordenados[1]
  if (vai === undefined || fica === undefined) return null

  return {
    vai,
    fica,
    deEquipeId: perdedora.teamId,
    deEquipeNome: perdedora.nome,
    paraEquipeId: solitaria.teamId,
    paraEquipeNome: solitaria.nome,
    solitario,
  }
}

/** Frase curta explicando a decisão, para a interface não mostrar só nomes. */
export function explicarRodizio(plano: PlanoDeRodizio): string {
  const { vai, fica } = plano
  if (vai.partidasSozinho > fica.partidasSozinho) {
    return `${vai.nome} já jogou sozinho ${vai.partidasSozinho}× e ${fica.nome}, ${fica.partidasSozinho}× — agora é a vez de ${fica.nome}.`
  }
  if (vai.vezesComOSolitario < fica.vezesComOSolitario) {
    return `Os dois ficaram sozinhos o mesmo tanto; ${vai.nome} formou dupla com ${plano.solitario.nome} menos vezes.`
  }
  return `Os dois estão empatados nos critérios; a ordem alfabética resolveu, sem peso esportivo.`
}
