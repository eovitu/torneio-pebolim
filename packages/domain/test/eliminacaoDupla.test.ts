/**
 * Eliminação dupla — a regra confirmada pelo proprietário em 20/08/2026.
 *
 * O que estes testes travam, em ordem de importância:
 *   1. perder UMA vez não elimina; perder DUAS vezes elimina;
 *   2. a final junta o campeão de cada chave;
 *   3. reset: o campeão dos perdedores vencendo a final força a segunda final;
 *   4. o campeão dos vencedores vencendo a final encerra tudo — sem reset;
 *   5. bye não é vitória e não manda ninguém para a chave dos perdedores.
 */

import { describe, expect, it } from 'vitest'
import {
  campeaoDaCopa,
  confrontosProntos,
  montarEliminacaoDupla,
  ordemDeChave,
  resolverEliminacaoDupla,
} from '../src/eliminacaoDupla.js'
import type { PlanoDeCopa, SlotResolvido } from '../src/eliminacaoDupla.js'

/** Roda a chave decidindo confronto a confronto, com `escolher` dando o vencedor. */
function disputar(
  plano: PlanoDeCopa,
  equipes: readonly string[],
  escolher: (slot: SlotResolvido) => string,
): { resolvidos: SlotResolvido[]; disputados: string[] } {
  const vencedorPorSlot = new Map<string, string>()
  const disputados: string[] = []
  for (let volta = 0; volta < 200; volta += 1) {
    const resolvidos = resolverEliminacaoDupla(plano, equipes, { vencedorPorSlot })
    const prontos = confrontosProntos(resolvidos)
    if (prontos.length === 0) {
      return { resolvidos, disputados }
    }
    for (const slot of prontos) {
      vencedorPorSlot.set(slot.id, escolher(slot))
      disputados.push(slot.id)
    }
  }
  throw new Error('a chave não terminou')
}

describe('ordem de chaveamento', () => {
  it('coloca a 1ª e a 2ª posições em lados opostos', () => {
    expect(ordemDeChave(4)).toEqual([1, 4, 2, 3])
    expect(ordemDeChave(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
    // A 1ª e a 2ª caem em metades opostas: só se encontram na decisão.
    const oito = ordemDeChave(8)
    expect(oito.slice(0, 4)).toContain(1)
    expect(oito.slice(4)).toContain(2)
  })
})

describe('desenho da chave', () => {
  it('com 4 equipes gera 3 jogos de vencedores, 2 de perdedores e as finais', () => {
    const plano = montarEliminacaoDupla(4)
    expect(plano.tamanhoDaChave).toBe(4)
    expect(plano.slots.filter((s) => s.chave === 'VENCEDORES')).toHaveLength(3)
    expect(plano.slots.filter((s) => s.chave === 'PERDEDORES')).toHaveLength(2)
    expect(plano.slots.filter((s) => s.chave === 'FINAL')).toHaveLength(1)
    expect(plano.slots.filter((s) => s.chave === 'FINAL_RESET')).toHaveLength(1)
  })

  it('com 8 equipes gera 7 jogos de vencedores e 6 de perdedores', () => {
    const plano = montarEliminacaoDupla(8)
    expect(plano.tamanhoDaChave).toBe(8)
    expect(plano.slots.filter((s) => s.chave === 'VENCEDORES')).toHaveLength(7)
    expect(plano.slots.filter((s) => s.chave === 'PERDEDORES')).toHaveLength(6)
  })

  it('arredonda para a potência de 2 acima quando o número não fecha', () => {
    expect(montarEliminacaoDupla(6).tamanhoDaChave).toBe(8)
    expect(montarEliminacaoDupla(3).tamanhoDaChave).toBe(4)
  })

  it('exige ao menos 2 equipes', () => {
    expect(() => montarEliminacaoDupla(1)).toThrow()
  })
})

describe('perder uma vez não elimina', () => {
  it('quem perde na chave dos vencedores reaparece na dos perdedores', () => {
    const plano = montarEliminacaoDupla(4)
    const equipes = ['A', 'B', 'C', 'D']
    // Chave de 4, ordem [1,4,2,3] → V1-1: A×D, V1-2: B×C.
    const vencedorPorSlot = new Map([
      ['V1-1', 'A'],
      ['V1-2', 'C'],
    ])
    const resolvidos = resolverEliminacaoDupla(plano, equipes, { vencedorPorSlot })
    const perdedores = resolvidos.find((s) => s.id === 'P1-1')

    expect(perdedores?.estado).toBe('PRONTO')
    expect([perdedores?.equipeA, perdedores?.equipeB].sort()).toEqual(['B', 'D'])
  })

  it('quem perde na chave dos perdedores não aparece em nenhum confronto seguinte', () => {
    const plano = montarEliminacaoDupla(4)
    const equipes = ['A', 'B', 'C', 'D']
    const vencedorPorSlot = new Map([
      ['V1-1', 'A'],
      ['V1-2', 'C'],
      ['P1-1', 'B'], // D toma a segunda derrota e está fora
    ])
    const resolvidos = resolverEliminacaoDupla(plano, equipes, { vencedorPorSlot })
    const aindaVivos = resolvidos
      .filter((s) => s.estado === 'PRONTO' || s.estado === 'INDEFINIDO')
      .flatMap((s) => [s.equipeA, s.equipeB])

    expect(aindaVivos).not.toContain('D')
    expect(aindaVivos).toContain('B')
  })
})

describe('as finais', () => {
  it('junta o campeão dos vencedores com o campeão dos perdedores', () => {
    const plano = montarEliminacaoDupla(4)
    const equipes = ['A', 'B', 'C', 'D']
    const vencedorPorSlot = new Map([
      ['V1-1', 'A'],
      ['V1-2', 'C'],
      ['V2-1', 'A'], // A é campeão dos vencedores; C cai
      ['P1-1', 'B'],
      ['P2-1', 'B'], // B é campeão dos perdedores
    ])
    const final = resolverEliminacaoDupla(plano, equipes, { vencedorPorSlot }).find(
      (s) => s.id === 'F',
    )

    expect(final?.estado).toBe('PRONTO')
    expect(final?.equipeA).toBe('A')
    expect(final?.equipeB).toBe('B')
  })

  it('vitória do campeão dos vencedores encerra a chave, sem segunda final', () => {
    const plano = montarEliminacaoDupla(4)
    const equipes = ['A', 'B', 'C', 'D']
    const vencedorPorSlot = new Map([
      ['V1-1', 'A'],
      ['V1-2', 'C'],
      ['V2-1', 'A'],
      ['P1-1', 'B'],
      ['P2-1', 'B'],
      ['F', 'A'],
    ])
    const resolvidos = resolverEliminacaoDupla(plano, equipes, { vencedorPorSlot })

    expect(resolvidos.find((s) => s.id === 'FR')?.estado).toBe('DISPENSADO')
    expect(campeaoDaCopa(resolvidos)).toBe('A')
  })

  it('vitória do campeão dos perdedores força a segunda final, e ela decide o título', () => {
    const plano = montarEliminacaoDupla(4)
    const equipes = ['A', 'B', 'C', 'D']
    const base: [string, string][] = [
      ['V1-1', 'A'],
      ['V1-2', 'C'],
      ['V2-1', 'A'],
      ['P1-1', 'B'],
      ['P2-1', 'B'],
      ['F', 'B'], // o campeão dos perdedores vence: os dois ficam com 1 derrota
    ]
    const semReset = resolverEliminacaoDupla(plano, equipes, {
      vencedorPorSlot: new Map(base),
    })
    const reset = semReset.find((s) => s.id === 'FR')

    expect(reset?.estado).toBe('PRONTO')
    expect([reset?.equipeA, reset?.equipeB].sort()).toEqual(['A', 'B'])
    // A chave ainda não tem campeão: falta a segunda decisão.
    expect(campeaoDaCopa(semReset)).toBeNull()

    const comReset = resolverEliminacaoDupla(plano, equipes, {
      vencedorPorSlot: new Map([...base, ['FR', 'B'] as [string, string]]),
    })
    expect(campeaoDaCopa(comReset)).toBe('B')
  })
})

describe('byes', () => {
  it('passar por bye não é vitória e não manda ninguém para a chave dos perdedores', () => {
    const plano = montarEliminacaoDupla(3)
    const equipes = ['A', 'B', 'C']
    const resolvidos = resolverEliminacaoDupla(plano, equipes, {
      vencedorPorSlot: new Map(),
    })

    // Chave de 4 com 3 equipes: uma posição fica vazia.
    const comBye = resolvidos.filter((s) => s.estado === 'BYE')
    expect(comBye.length).toBeGreaterThan(0)

    // A primeira rodada dos perdedores recebe só um caído de verdade — logo ela
    // própria vira um bye, e ninguém é eliminado sem jogar.
    const p1 = resolvidos.find((s) => s.id === 'P1-1')
    expect(p1?.estado).toBe('BYE')
  })
})

describe('a chave inteira termina', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8]) {
    it(`com ${n} equipes, sempre sai um campeão e ninguém perde três vezes`, () => {
      const plano = montarEliminacaoDupla(n)
      const equipes = Array.from({ length: n }, (_, i) => `E${i + 1}`)
      // A equipe de menor número sempre vence: resultado determinístico.
      const { resolvidos } = disputar(plano, equipes, (slot) => {
        const a = Number((slot.equipeA ?? 'E999').slice(1))
        const b = Number((slot.equipeB ?? 'E999').slice(1))
        return a < b ? (slot.equipeA as string) : (slot.equipeB as string)
      })

      expect(campeaoDaCopa(resolvidos)).toBe('E1')

      const derrotas = new Map<string, number>()
      for (const s of resolvidos) {
        if (s.estado !== 'DECIDIDO' || s.perdedor === null) continue
        derrotas.set(s.perdedor, (derrotas.get(s.perdedor) ?? 0) + 1)
      }
      for (const [, qtd] of derrotas) expect(qtd).toBeLessThanOrEqual(2)
      // O campeão invicto não pode ter derrota nenhuma.
      expect(derrotas.get('E1') ?? 0).toBe(0)
    })
  }

  it('com o azarão vencendo tudo na chave dos perdedores, ainda sai campeão', () => {
    const plano = montarEliminacaoDupla(4)
    const equipes = ['A', 'B', 'C', 'D']
    // Quem estiver na posição B (o segundo lado) vence sempre.
    const { resolvidos } = disputar(plano, equipes, (slot) => slot.equipeB as string)
    expect(campeaoDaCopa(resolvidos)).not.toBeNull()
  })
})
