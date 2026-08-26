/**
 * Mata-mata simples (KNOCKOUT), confirmado pelo proprietário em 26/08/2026.
 *
 * A mecânica, exatamente como foi confirmada:
 *
 *   - o chaveamento sai AUTOMATICAMENTE da classificação da fase de grupos;
 *   - só entram as N melhores equipes, onde N é a MAIOR potência de 2 menor ou
 *     igual ao número de equipes do torneio. Quem fica fora desse corte está
 *     eliminado: sem chave, sem consolação, sem jogo nenhum;
 *   - o emparelhamento é por semeadura — o melhor colocado pega o pior, o
 *     segundo pega o penúltimo, e assim por diante;
 *   - quando existe semifinal (chave de 4 ou mais), os dois perdedores dela
 *     disputam o TERCEIRO LUGAR. Em chave de 2 essa disputa não existe;
 *   - a GRANDE FINAL é MELHOR DE 2 JOGOS. Os dois jogos são sempre disputados;
 *     campeão é quem vencer os dois. Se cada um vencer um, uma TERCEIRA
 *     partida decide o título.
 *
 * Este módulo é puro: monta o desenho da chave e resolve quem ocupa cada
 * confronto a partir dos resultados. Não conhece banco, tela nem relógio
 * (§50). O banco espelha esta mesma montagem, e a interface só desenha.
 *
 * SOBRE O CORTE
 *
 * O corte é o que torna a chave exata: com 5, 6 ou 7 equipes a chave é de 4, e
 * as excedentes simplesmente não avançam. Por isso — ao contrário da Copa —
 * aqui NÃO existe bye: o número de participantes é sempre uma potência de 2.
 *
 * SOBRE EMPATE
 *
 * Não existe empate em partida de mata-mata: o §37 já resolve, mandando para o
 * Gol de Ouro quem terminar o tempo regulamentar igual. Isso vale inclusive
 * para a terceira partida da final, que por isso não precisa de regra própria
 * de desempate: ela não pode acabar empatada.
 */

/** Em que trecho da chave o confronto acontece. */
export type ChaveDeMataMata = 'ELIMINATORIA' | 'TERCEIRO_LUGAR' | 'FINAL'

/** De onde sai cada lado de um confronto. */
export type OrigemDeMataMata =
  /** Uma das equipes classificadas, pela posição de semeadura. */
  | { tipo: 'EQUIPE'; posicao: number }
  | { tipo: 'VENCEDOR'; slot: string }
  | { tipo: 'PERDEDOR'; slot: string }

export interface SlotDeMataMata {
  /** Identificador estável do confronto: `R1-2`, `T`, `F1`, `F2`, `F3`. */
  id: string
  chave: ChaveDeMataMata
  rodada: number
  posicao: number
  origemA: OrigemDeMataMata
  origemB: OrigemDeMataMata
  /** Rótulo humano da fase daquele confronto. */
  rotulo: string
}

export interface PlanoDeMataMata {
  /** Quantas equipes se inscreveram, antes do corte. */
  inscritas: number
  /** Quantas equipes entram na chave: a potência de 2 do corte. */
  tamanhoDaChave: number
  /** Rodadas eliminatórias antes da final (0 em chave de 2). */
  rodadasEliminatorias: number
  /** A chave tem disputa de terceiro lugar? Só a partir de 4 equipes. */
  temTerceiroLugar: boolean
  slots: SlotDeMataMata[]
}

/**
 * Maior potência de 2 menor ou igual a `n` — a regra de corte do mata-mata.
 *
 *   2 → 2 · 3 → 2 · 4 → 4 · 5, 6, 7 → 4 · 8 → 8 · 15 → 8 · 16 → 16
 */
export function corteDeMataMata(n: number): number {
  if (!Number.isInteger(n)) throw new Error('o número de equipes precisa ser inteiro')
  if (n < 2) throw new Error('são necessárias ao menos 2 equipes para uma chave')
  let s = 1
  while (s * 2 <= n) s *= 2
  return s
}

/**
 * Ordem clássica de chaveamento por semeadura — a mesma da Copa.
 *
 * Garante que o 1º e o 2º colocados só se encontrem na final, e que o melhor
 * colocado sempre enfrente o pior da chave.
 *
 *   2 → [1, 2]
 *   4 → [1, 4, 2, 3]          (1×4 e 2×3)
 *   8 → [1, 8, 4, 5, 2, 7, 3, 6]
 */
export function ordemDeSemeadura(tamanho: number): number[] {
  let ordem = [1, 2]
  while (ordem.length < tamanho) {
    const total = ordem.length * 2 + 1
    ordem = ordem.flatMap((p) => [p, total - p])
  }
  return ordem
}

/** Rótulo da rodada eliminatória, contando de trás para frente a partir da final. */
function rotuloDaRodada(rodada: number, rodadasAteAFinal: number): string {
  const faltam = rodadasAteAFinal - rodada
  if (faltam === 0) return 'Semifinal'
  if (faltam === 1) return 'Quartas de final'
  if (faltam === 2) return 'Oitavas de final'
  if (faltam === 3) return 'Dezesseis avos de final'
  return `${rodada}ª rodada`
}

/**
 * Monta o desenho completo da chave a partir do número de equipes INSCRITAS.
 *
 * O corte é aplicado aqui: `inscritas` é quantas existem, `tamanhoDaChave` é
 * quantas de fato entram. As posições de semeadura vão de 1 a `tamanhoDaChave`
 * e correspondem à classificação — posição 1 é o primeiro colocado.
 */
export function montarMataMata(inscritas: number): PlanoDeMataMata {
  const tamanho = corteDeMataMata(inscritas)
  const m = Math.log2(tamanho)
  const rodadasEliminatorias = m - 1
  const temTerceiroLugar = tamanho >= 4
  const slots: SlotDeMataMata[] = []

  const idR = (r: number, p: number) => `R${r}-${p}`

  // ---- rodadas eliminatórias -----------------------------------------------
  const ordem = ordemDeSemeadura(tamanho)
  for (let r = 1; r <= rodadasEliminatorias; r += 1) {
    const jogos = tamanho / 2 ** r
    for (let p = 1; p <= jogos; p += 1) {
      slots.push({
        id: idR(r, p),
        chave: 'ELIMINATORIA',
        rodada: r,
        posicao: p,
        rotulo: rotuloDaRodada(r, rodadasEliminatorias),
        origemA:
          r === 1
            ? { tipo: 'EQUIPE', posicao: ordem[2 * p - 2] ?? 0 }
            : { tipo: 'VENCEDOR', slot: idR(r - 1, 2 * p - 1) },
        origemB:
          r === 1
            ? { tipo: 'EQUIPE', posicao: ordem[2 * p - 1] ?? 0 }
            : { tipo: 'VENCEDOR', slot: idR(r - 1, 2 * p) },
      })
    }
  }

  // Quem chega à final: os vencedores da semifinal, ou — em chave de 2 — as
  // duas equipes classificadas, que vão direto para a decisão.
  const finalistaA: OrigemDeMataMata =
    rodadasEliminatorias === 0
      ? { tipo: 'EQUIPE', posicao: 1 }
      : { tipo: 'VENCEDOR', slot: idR(rodadasEliminatorias, 1) }
  const finalistaB: OrigemDeMataMata =
    rodadasEliminatorias === 0
      ? { tipo: 'EQUIPE', posicao: 2 }
      : { tipo: 'VENCEDOR', slot: idR(rodadasEliminatorias, 2) }

  // ---- disputa de terceiro lugar -------------------------------------------
  if (temTerceiroLugar) {
    slots.push({
      id: 'T',
      chave: 'TERCEIRO_LUGAR',
      rodada: rodadasEliminatorias + 1,
      posicao: 1,
      rotulo: 'Disputa de 3º lugar',
      origemA: { tipo: 'PERDEDOR', slot: idR(rodadasEliminatorias, 1) },
      origemB: { tipo: 'PERDEDOR', slot: idR(rodadasEliminatorias, 2) },
    })
  }

  // ---- grande final, melhor de 2 -------------------------------------------
  // O segundo jogo inverte os lados: nenhum dos dois fica sempre como equipe A.
  slots.push({
    id: 'F1',
    chave: 'FINAL',
    rodada: rodadasEliminatorias + 1,
    posicao: 1,
    rotulo: 'Final — jogo 1',
    origemA: finalistaA,
    origemB: finalistaB,
  })
  slots.push({
    id: 'F2',
    chave: 'FINAL',
    rodada: rodadasEliminatorias + 1,
    posicao: 2,
    rotulo: 'Final — jogo 2',
    origemA: finalistaB,
    origemB: finalistaA,
  })
  // A terceira partida só existe se a série terminar 1 a 1. Os dois lados saem
  // do primeiro jogo, então bastam os dois finalistas já conhecidos.
  slots.push({
    id: 'F3',
    chave: 'FINAL',
    rodada: rodadasEliminatorias + 1,
    posicao: 3,
    rotulo: 'Final — jogo de desempate',
    origemA: { tipo: 'VENCEDOR', slot: 'F1' },
    origemB: { tipo: 'PERDEDOR', slot: 'F1' },
  })

  return {
    inscritas,
    tamanhoDaChave: tamanho,
    rodadasEliminatorias,
    temTerceiroLugar,
    slots,
  }
}

/* -------------------------------------------------------------------------- */
/* Resolução                                                                  */
/* -------------------------------------------------------------------------- */

/** Quem venceu cada confronto já decidido, por id de slot. */
export interface ResultadosDeMataMata {
  /** `slotId` → id da equipe vencedora. */
  vencedorPorSlot: ReadonlyMap<string, string>
}

export type EstadoDeSlotMataMata =
  /** Ainda falta saber quem joga. */
  | 'INDEFINIDO'
  /** Os dois lados são conhecidos e a partida pode ser criada. */
  | 'PRONTO'
  /** Já foi decidido. */
  | 'DECIDIDO'
  /** Não vai acontecer — é o caso do jogo 3 quando a série acabou 2 a 0. */
  | 'DISPENSADO'

export interface SlotDeMataMataResolvido extends SlotDeMataMata {
  equipeA: string | null
  equipeB: string | null
  estado: EstadoDeSlotMataMata
  vencedor: string | null
  perdedor: string | null
}

/**
 * Resolve quem ocupa cada confronto da chave.
 *
 * `equipesEmOrdem` é a classificação já cortada: a primeira da lista é o
 * primeiro colocado e ocupa a posição 1 de semeadura. Passar mais equipes que
 * o tamanho da chave é erro de quem chama — o corte é feito antes, por
 * `corteDeMataMata`.
 */
export function resolverMataMata(
  plano: PlanoDeMataMata,
  equipesEmOrdem: readonly string[],
  resultados: ResultadosDeMataMata,
): SlotDeMataMataResolvido[] {
  const porId = new Map(plano.slots.map((s) => [s.id, s]))
  const vencedorDe = new Map<string, string>()
  const perdedorDe = new Map<string, string>()
  const resolvidos = new Map<string, SlotDeMataMataResolvido>()

  const ocupanteDe = (origem: OrigemDeMataMata): string | null => {
    if (origem.tipo === 'EQUIPE') return equipesEmOrdem[origem.posicao - 1] ?? null
    resolver(origem.slot)
    const mapa = origem.tipo === 'VENCEDOR' ? vencedorDe : perdedorDe
    return mapa.get(origem.slot) ?? null
  }

  function resolver(id: string): SlotDeMataMataResolvido {
    const existente = resolvidos.get(id)
    if (existente !== undefined) return existente

    const slot = porId.get(id)
    if (slot === undefined) throw new Error(`confronto desconhecido: ${id}`)

    // Marcador contra recursão infinita — a chave é um grafo acíclico, mas um
    // plano corrompido não pode travar a tela.
    const provisorio: SlotDeMataMataResolvido = {
      ...slot,
      equipeA: null,
      equipeB: null,
      estado: 'INDEFINIDO',
      vencedor: null,
      perdedor: null,
    }
    resolvidos.set(id, provisorio)

    // O jogo 3 da final só existe com a série empatada em 1 a 1.
    if (id === 'F3') {
      const jogo1 = resolver('F1')
      const jogo2 = resolver('F2')
      if (jogo1.estado === 'DECIDIDO' && jogo2.estado === 'DECIDIDO') {
        if (jogo1.vencedor === jogo2.vencedor) {
          const dispensado = { ...provisorio, estado: 'DISPENSADO' as const }
          resolvidos.set(id, dispensado)
          return dispensado
        }
      }
    }

    const a = ocupanteDe(slot.origemA)
    const b = ocupanteDe(slot.origemB)

    const linha: SlotDeMataMataResolvido = {
      ...slot,
      equipeA: a,
      equipeB: b,
      estado: 'INDEFINIDO',
      vencedor: null,
      perdedor: null,
    }

    if (a === null || b === null) {
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
export function confrontosProntosDeMataMata(
  resolvidos: readonly SlotDeMataMataResolvido[],
): SlotDeMataMataResolvido[] {
  return resolvidos.filter((s) => s.estado === 'PRONTO')
}

/** O pódio do torneio. Cada posição é `null` enquanto não estiver decidida. */
export interface Podio {
  campeao: string | null
  vice: string | null
  terceiro: string | null
}

/**
 * Pódio da chave.
 *
 * Campeão é quem vence 2 dos até 3 jogos da final; vice é o outro finalista.
 * O bronze sai da disputa de 3º lugar — e em chave de 2 ele não existe, porque
 * ninguém perdeu semifinal alguma.
 */
export function podioDoMataMata(resolvidos: readonly SlotDeMataMataResolvido[]): Podio {
  const porId = new Map(resolvidos.map((s) => [s.id, s]))
  const decididos = ['F1', 'F2', 'F3']
    .map((id) => porId.get(id))
    .filter((s): s is SlotDeMataMataResolvido => s !== undefined && s.estado === 'DECIDIDO')

  const vitorias = new Map<string, number>()
  for (const jogo of decididos) {
    if (jogo.vencedor === null) continue
    vitorias.set(jogo.vencedor, (vitorias.get(jogo.vencedor) ?? 0) + 1)
  }

  let campeao: string | null = null
  for (const [equipe, total] of vitorias) {
    if (total >= 2) campeao = equipe
  }

  const jogo1 = porId.get('F1')
  let vice: string | null = null
  if (campeao !== null && jogo1 !== undefined) {
    vice = jogo1.equipeA === campeao ? jogo1.equipeB : jogo1.equipeA
  }

  const terceiro = porId.get('T')
  return {
    campeao,
    vice,
    terceiro: terceiro !== undefined && terceiro.estado === 'DECIDIDO' ? terceiro.vencedor : null,
  }
}
