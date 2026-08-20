/**
 * Eliminação dupla ("Copa"), confirmada pelo proprietário em 20/08/2026.
 *
 * A mecânica, exatamente como foi confirmada:
 *
 *   - todo mundo começa na CHAVE DOS VENCEDORES;
 *   - quem perde na chave dos vencedores NÃO está eliminado: cai para a CHAVE
 *     DOS PERDEDORES e continua disputando;
 *   - quem perde na chave dos perdedores está eliminado — é a segunda derrota;
 *   - a FINAL junta o campeão dos vencedores com o campeão dos perdedores;
 *   - **reset na final**: se quem vencer a final vier da chave dos perdedores,
 *     os dois passam a ter uma derrota cada e joga-se uma SEGUNDA final, que
 *     decide o título. Se o campeão dos vencedores ganhar a primeira final,
 *     acabou — ele seguiria invicto, e a segunda final não existe.
 *
 * Este módulo é puro: monta o desenho da chave e resolve quem ocupa cada
 * confronto a partir dos resultados. Não conhece banco, tela nem relógio
 * (§50). O banco espelha esta mesma montagem, e a interface só desenha.
 *
 * SOBRE O NÚMERO DE EQUIPES
 *
 * A chave trabalha com potências de 2. Com 6 equipes, a chave é de 8 e duas
 * delas passam direto na primeira rodada — é o BYE, e não uma vitória: quem
 * passa por bye não ganha jogo nem manda ninguém para a chave dos perdedores.
 *
 * SOBRE EMPATE
 *
 * Não existe empate aqui. Eliminação dupla é mata-mata, e o §37 já resolve:
 * empate no tempo regulamentar vai para o Gol de Ouro. Este módulo pressupõe
 * que toda partida encerrada tem um vencedor.
 */

/** Em que chave o confronto acontece. */
export type ChaveDeCopa = 'VENCEDORES' | 'PERDEDORES' | 'FINAL' | 'FINAL_RESET'

/** De onde sai cada lado de um confronto. */
export type OrigemDeSlot =
  /** Uma das equipes inscritas, pela posição no chaveamento inicial. */
  | { tipo: 'EQUIPE'; posicao: number }
  | { tipo: 'VENCEDOR'; slot: string }
  | { tipo: 'PERDEDOR'; slot: string }

export interface SlotDeCopa {
  /** Identificador estável do confronto: `V2-1`, `P3-2`, `F`, `FR`. */
  id: string
  chave: ChaveDeCopa
  rodada: number
  posicao: number
  origemA: OrigemDeSlot
  origemB: OrigemDeSlot
  /** Rótulo humano da fase daquele confronto. */
  rotulo: string
}

export interface PlanoDeCopa {
  /** Quantas equipes disputam. */
  equipes: number
  /** Tamanho da chave: a potência de 2 imediatamente acima (ou igual). */
  tamanhoDaChave: number
  /** Rodadas da chave dos vencedores. */
  rodadasVencedores: number
  /** Rodadas da chave dos perdedores. */
  rodadasPerdedores: number
  slots: SlotDeCopa[]
}

/** Menor potência de 2 maior ou igual a `n`. */
function potenciaDeDois(n: number): number {
  let s = 1
  while (s < n) s *= 2
  return s
}

/**
 * Ordem clássica de chaveamento.
 *
 * Garante que a 1ª e a 2ª posições só se encontrem na decisão da chave dos
 * vencedores, e distribui os byes entre as posições mais bem colocadas — que é
 * o comportamento esperado de qualquer chave de mata-mata.
 *
 *   4 → [1, 4, 2, 3]
 *   8 → [1, 8, 4, 5, 2, 7, 3, 6]
 */
export function ordemDeChave(tamanho: number): number[] {
  let ordem = [1, 2]
  while (ordem.length < tamanho) {
    const total = ordem.length * 2 + 1
    ordem = ordem.flatMap((p) => [p, total - p])
  }
  return ordem
}

/** Rótulo da rodada da chave dos vencedores, contando de trás para frente. */
function rotuloVencedores(rodada: number, totalDeRodadas: number): string {
  const faltam = totalDeRodadas - rodada
  if (faltam === 0) return 'Decisão dos vencedores'
  if (faltam === 1) return 'Semifinal dos vencedores'
  if (faltam === 2) return 'Quartas dos vencedores'
  return `Vencedores — ${rodada}ª rodada`
}

/**
 * Monta o desenho completo da chave.
 *
 * Estrutura da chave dos perdedores, que é a parte que costuma confundir: ela
 * alterna rodadas. Uma rodada ÍMPAR junta sobreviventes da própria chave dos
 * perdedores; a rodada PAR seguinte junta quem sobreviveu com os recém-caídos
 * da chave dos vencedores. É essa alternância que faz cada equipe precisar de
 * duas derrotas para sair.
 */
export function montarEliminacaoDupla(equipes: number): PlanoDeCopa {
  if (!Number.isInteger(equipes)) {
    throw new Error('o número de equipes precisa ser inteiro')
  }
  if (equipes < 2) {
    throw new Error('são necessárias ao menos 2 equipes para uma chave')
  }

  const tamanho = potenciaDeDois(equipes)
  const m = Math.log2(tamanho)
  const rodadasPerdedores = m === 1 ? 1 : 2 * m - 2
  const slots: SlotDeCopa[] = []

  const idV = (r: number, p: number) => `V${r}-${p}`
  const idP = (r: number, p: number) => `P${r}-${p}`

  // ---- chave dos vencedores ------------------------------------------------
  const ordem = ordemDeChave(tamanho)
  for (let r = 1; r <= m; r += 1) {
    const jogos = tamanho / 2 ** r
    for (let p = 1; p <= jogos; p += 1) {
      slots.push({
        id: idV(r, p),
        chave: 'VENCEDORES',
        rodada: r,
        posicao: p,
        rotulo: rotuloVencedores(r, m),
        origemA:
          r === 1
            ? { tipo: 'EQUIPE', posicao: ordem[2 * p - 2] ?? 0 }
            : { tipo: 'VENCEDOR', slot: idV(r - 1, 2 * p - 1) },
        origemB:
          r === 1
            ? { tipo: 'EQUIPE', posicao: ordem[2 * p - 1] ?? 0 }
            : { tipo: 'VENCEDOR', slot: idV(r - 1, 2 * p) },
      })
    }
  }

  // ---- chave dos perdedores ------------------------------------------------
  // Com chave de 2 não há chave de perdedores de verdade: a única derrota já
  // manda direto para a final.
  if (m >= 2) {
    for (let k = 1; k <= m - 1; k += 1) {
      const jogos = tamanho / 2 ** (k + 1)

      // Rodada ímpar: quem caiu da chave dos vencedores na rodada k se enfrenta
      // (k = 1) ou os sobreviventes da chave dos perdedores se enfrentam.
      const rImpar = 2 * k - 1
      for (let p = 1; p <= jogos; p += 1) {
        slots.push({
          id: idP(rImpar, p),
          chave: 'PERDEDORES',
          rodada: rImpar,
          posicao: p,
          rotulo: `Perdedores — ${rImpar}ª rodada`,
          origemA:
            k === 1
              ? { tipo: 'PERDEDOR', slot: idV(1, 2 * p - 1) }
              : { tipo: 'VENCEDOR', slot: idP(2 * k - 2, 2 * p - 1) },
          origemB:
            k === 1
              ? { tipo: 'PERDEDOR', slot: idV(1, 2 * p) }
              : { tipo: 'VENCEDOR', slot: idP(2 * k - 2, 2 * p) },
        })
      }

      // Rodada par: quem sobreviveu acima encara quem acabou de cair da chave
      // dos vencedores. A ordem dos caídos é invertida para adiar reencontros
      // entre quem já se enfrentou na chave dos vencedores.
      const rPar = 2 * k
      for (let p = 1; p <= jogos; p += 1) {
        slots.push({
          id: idP(rPar, p),
          chave: 'PERDEDORES',
          rodada: rPar,
          posicao: p,
          rotulo:
            rPar === rodadasPerdedores
              ? 'Decisão dos perdedores'
              : `Perdedores — ${rPar}ª rodada`,
          origemA: { tipo: 'VENCEDOR', slot: idP(rImpar, p) },
          origemB: { tipo: 'PERDEDOR', slot: idV(k + 1, jogos - p + 1) },
        })
      }
    }
  }

  // ---- finais --------------------------------------------------------------
  const campeaoDosPerdedores: OrigemDeSlot =
    m === 1
      ? { tipo: 'PERDEDOR', slot: idV(1, 1) }
      : { tipo: 'VENCEDOR', slot: idP(rodadasPerdedores, 1) }

  slots.push({
    id: 'F',
    chave: 'FINAL',
    rodada: 1,
    posicao: 1,
    rotulo: 'Final',
    origemA: { tipo: 'VENCEDOR', slot: idV(m, 1) },
    origemB: campeaoDosPerdedores,
  })

  slots.push({
    id: 'FR',
    chave: 'FINAL_RESET',
    rodada: 2,
    posicao: 1,
    rotulo: 'Final — segunda decisão',
    origemA: { tipo: 'PERDEDOR', slot: 'F' },
    origemB: { tipo: 'VENCEDOR', slot: 'F' },
  })

  return {
    equipes,
    tamanhoDaChave: tamanho,
    rodadasVencedores: m,
    rodadasPerdedores: m === 1 ? 0 : rodadasPerdedores,
    slots,
  }
}

/* -------------------------------------------------------------------------- */
/* Resolução                                                                  */
/* -------------------------------------------------------------------------- */

/** Quem venceu cada confronto já decidido, por id de slot. */
export interface ResultadosDaCopa {
  /** `slotId` → id da equipe vencedora. */
  vencedorPorSlot: ReadonlyMap<string, string>
}

export type EstadoDoSlot =
  /** Ainda falta saber quem joga. */
  | 'INDEFINIDO'
  /** Os dois lados são conhecidos e a partida pode ser criada. */
  | 'PRONTO'
  /** Só um lado existe: alguém passa sem jogar. */
  | 'BYE'
  /** Já foi decidido. */
  | 'DECIDIDO'
  /** Não vai acontecer — é o caso da segunda final quando não houve reset. */
  | 'DISPENSADO'

export interface SlotResolvido extends SlotDeCopa {
  /** `null` = ainda indefinido; `BYE` = lado vazio da chave. */
  equipeA: string | null
  equipeB: string | null
  byeA: boolean
  byeB: boolean
  estado: EstadoDoSlot
  vencedor: string | null
  perdedor: string | null
}

const BYE = Symbol('bye')
type Ocupante = string | typeof BYE | null

/**
 * Resolve quem ocupa cada confronto da chave.
 *
 * `equipesEmOrdem` é a lista de equipes na ordem de chaveamento: a primeira da
 * lista ocupa a posição 1, e assim por diante. Posições acima do número de
 * equipes são bye.
 *
 * Um lado marcado como bye faz a equipe do outro lado avançar sem jogo, e não
 * gera derrotado — quem passa por bye não manda ninguém para a chave dos
 * perdedores, porque ninguém perdeu.
 */
export function resolverEliminacaoDupla(
  plano: PlanoDeCopa,
  equipesEmOrdem: readonly string[],
  resultados: ResultadosDaCopa,
): SlotResolvido[] {
  const porId = new Map(plano.slots.map((s) => [s.id, s]))
  const vencedorDe = new Map<string, Ocupante>()
  const perdedorDe = new Map<string, Ocupante>()
  const resolvidos = new Map<string, SlotResolvido>()

  const ocupanteDe = (origem: OrigemDeSlot): Ocupante => {
    if (origem.tipo === 'EQUIPE') {
      return equipesEmOrdem[origem.posicao - 1] ?? BYE
    }
    resolver(origem.slot)
    const mapa = origem.tipo === 'VENCEDOR' ? vencedorDe : perdedorDe
    return mapa.get(origem.slot) ?? null
  }

  function resolver(id: string): SlotResolvido {
    const existente = resolvidos.get(id)
    if (existente !== undefined) return existente

    const slot = porId.get(id)
    if (slot === undefined) throw new Error(`confronto desconhecido: ${id}`)

    // Marcador contra recursão infinita — a chave é um grafo acíclico, mas um
    // plano corrompido não pode travar a tela.
    const provisorio: SlotResolvido = {
      ...slot,
      equipeA: null,
      equipeB: null,
      byeA: false,
      byeB: false,
      estado: 'INDEFINIDO',
      vencedor: null,
      perdedor: null,
    }
    resolvidos.set(id, provisorio)

    const a = ocupanteDe(slot.origemA)
    const b = ocupanteDe(slot.origemB)

    const linha: SlotResolvido = {
      ...slot,
      equipeA: typeof a === 'string' ? a : null,
      equipeB: typeof b === 'string' ? b : null,
      byeA: a === BYE,
      byeB: b === BYE,
      estado: 'INDEFINIDO',
      vencedor: null,
      perdedor: null,
    }

    // A segunda final só existe se o campeão dos perdedores vencer a primeira.
    if (slot.id === 'FR') {
      const final = resolver('F')
      const houveReset =
        final.estado === 'DECIDIDO' &&
        final.vencedor !== null &&
        final.vencedor === final.equipeB
      if (final.estado === 'DECIDIDO' && !houveReset) {
        linha.estado = 'DISPENSADO'
        resolvidos.set(id, linha)
        return linha
      }
    }

    // Bye: quem tem par vazio passa sem jogar, e não há derrotado.
    if ((a === BYE) !== (b === BYE)) {
      const quemPassa = a === BYE ? b : a
      linha.estado = 'BYE'
      vencedorDe.set(id, quemPassa)
      perdedorDe.set(id, BYE)
      resolvidos.set(id, linha)
      return linha
    }

    // Os dois lados vazios: o confronto inteiro é vazio.
    if (a === BYE && b === BYE) {
      linha.estado = 'BYE'
      vencedorDe.set(id, BYE)
      perdedorDe.set(id, BYE)
      resolvidos.set(id, linha)
      return linha
    }

    // Sobrou o caso normal: os dois lados são equipes de verdade. O `typeof`
    // cobre de uma vez o lado ainda indefinido (null) e o bye (símbolo), que os
    // blocos acima já trataram.
    if (typeof a !== 'string' || typeof b !== 'string') {
      resolvidos.set(id, linha)
      return linha
    }

    const vencedor = resultados.vencedorPorSlot.get(id) ?? null
    if (vencedor === null) {
      linha.estado = 'PRONTO'
      resolvidos.set(id, linha)
      return linha
    }
    if (vencedor !== a && vencedor !== b) {
      throw new Error(`o vencedor informado para ${id} não disputa este confronto`)
    }

    linha.estado = 'DECIDIDO'
    linha.vencedor = vencedor
    linha.perdedor = vencedor === a ? b : a
    vencedorDe.set(id, vencedor)
    perdedorDe.set(id, linha.perdedor)
    resolvidos.set(id, linha)
    return linha
  }

  return plano.slots.map((s) => resolver(s.id))
}

/** Confrontos que já têm os dois lados e ainda não foram disputados. */
export function confrontosProntos(resolvidos: readonly SlotResolvido[]): SlotResolvido[] {
  return resolvidos.filter((s) => s.estado === 'PRONTO')
}

/**
 * Campeão da chave, quando já existe.
 *
 * É o vencedor da segunda final quando ela aconteceu, e o da primeira quando
 * ela não foi necessária.
 */
export function campeaoDaCopa(resolvidos: readonly SlotResolvido[]): string | null {
  const reset = resolvidos.find((s) => s.id === 'FR')
  if (reset !== undefined && reset.estado === 'DECIDIDO') return reset.vencedor
  const final = resolvidos.find((s) => s.id === 'F')
  if (final === undefined || final.estado !== 'DECIDIDO') return null
  // Vitória do campeão dos vencedores encerra a chave; a do outro força o reset.
  return final.vencedor === final.equipeA ? final.vencedor : null
}
