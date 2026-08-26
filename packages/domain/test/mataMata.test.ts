import { describe, expect, it } from 'vitest'
import {
  confrontosProntosDeMataMata,
  corteDeMataMata,
  montarMataMata,
  ordemDeSemeadura,
  podioDoMataMata,
  resolverMataMata,
} from '../src/mataMata.js'
import type { PlanoDeMataMata, SlotDeMataMataResolvido } from '../src/mataMata.js'

/** Resolve a chave aplicando os vencedores informados por id de slot. */
function resolver(
  plano: PlanoDeMataMata,
  equipes: readonly string[],
  vencedores: Record<string, string> = {},
): Map<string, SlotDeMataMataResolvido> {
  const linhas = resolverMataMata(plano, equipes, {
    vencedorPorSlot: new Map(Object.entries(vencedores)),
  })
  return new Map(linhas.map((s) => [s.id, s]))
}

describe('corte do mata-mata', () => {
  it('usa a maior potência de 2 menor ou igual ao número de equipes', () => {
    expect(corteDeMataMata(2)).toBe(2)
    expect(corteDeMataMata(3)).toBe(2)
    expect(corteDeMataMata(4)).toBe(4)
    expect(corteDeMataMata(5)).toBe(4)
    expect(corteDeMataMata(6)).toBe(4)
    expect(corteDeMataMata(7)).toBe(4)
    expect(corteDeMataMata(8)).toBe(8)
    expect(corteDeMataMata(15)).toBe(8)
    expect(corteDeMataMata(16)).toBe(16)
    expect(corteDeMataMata(33)).toBe(32)
  })

  it('recusa menos de 2 equipes e números quebrados', () => {
    expect(() => corteDeMataMata(1)).toThrow(/ao menos 2 equipes/)
    expect(() => corteDeMataMata(2.5)).toThrow(/inteiro/)
  })
})

describe('semeadura', () => {
  it('faz o melhor colocado pegar o pior', () => {
    expect(ordemDeSemeadura(2)).toEqual([1, 2])
    expect(ordemDeSemeadura(4)).toEqual([1, 4, 2, 3])
    expect(ordemDeSemeadura(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
  })
})

describe('desenho da chave', () => {
  it('com 2 equipes vai direto para a final, sem semifinal nem 3º lugar', () => {
    const plano = montarMataMata(2)
    expect(plano.tamanhoDaChave).toBe(2)
    expect(plano.rodadasEliminatorias).toBe(0)
    expect(plano.temTerceiroLugar).toBe(false)
    expect(plano.slots.map((s) => s.id)).toEqual(['F1', 'F2', 'F3'])
  })

  it('com 3 equipes corta para 2 — a terceira colocada não entra na chave', () => {
    const plano = montarMataMata(3)
    expect(plano.inscritas).toBe(3)
    expect(plano.tamanhoDaChave).toBe(2)

    const slots = resolver(plano, ['1º', '2º'])
    expect(slots.get('F1')?.equipeA).toBe('1º')
    expect(slots.get('F1')?.equipeB).toBe('2º')
  })

  it('com 4 equipes monta 1×4 e 2×3 na semifinal', () => {
    const plano = montarMataMata(4)
    expect(plano.rodadasEliminatorias).toBe(1)
    expect(plano.temTerceiroLugar).toBe(true)

    const slots = resolver(plano, ['1º', '2º', '3º', '4º'])
    expect(slots.get('R1-1')?.rotulo).toBe('Semifinal')
    expect([slots.get('R1-1')?.equipeA, slots.get('R1-1')?.equipeB]).toEqual(['1º', '4º'])
    expect([slots.get('R1-2')?.equipeA, slots.get('R1-2')?.equipeB]).toEqual(['2º', '3º'])
  })

  it('com 5, 6 ou 7 equipes a chave continua sendo de 4', () => {
    for (const n of [5, 6, 7]) {
      const plano = montarMataMata(n)
      expect(plano.tamanhoDaChave).toBe(4)
      expect(plano.slots.filter((s) => s.chave === 'ELIMINATORIA')).toHaveLength(2)
    }
  })

  it('com 8 equipes monta quartas, semifinal e final', () => {
    const plano = montarMataMata(8)
    expect(plano.rodadasEliminatorias).toBe(2)
    const quartas = plano.slots.filter((s) => s.rotulo === 'Quartas de final')
    const semis = plano.slots.filter((s) => s.rotulo === 'Semifinal')
    expect(quartas).toHaveLength(4)
    expect(semis).toHaveLength(2)

    const slots = resolver(plano, ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º'])
    expect([slots.get('R1-1')?.equipeA, slots.get('R1-1')?.equipeB]).toEqual(['1º', '8º'])
  })

  it('com 16 equipes a rodada mais funda são as oitavas', () => {
    const plano = montarMataMata(16)
    expect(plano.rodadasEliminatorias).toBe(3)
    expect(plano.slots.filter((s) => s.rotulo === 'Oitavas de final')).toHaveLength(8)
  })
})

describe('terceiro lugar', () => {
  it('junta os dois perdedores da semifinal', () => {
    const plano = montarMataMata(4)
    const equipes = ['1º', '2º', '3º', '4º']
    const slots = resolver(plano, equipes, { 'R1-1': '1º', 'R1-2': '3º' })

    const terceiro = slots.get('T')
    expect(terceiro?.estado).toBe('PRONTO')
    expect([terceiro?.equipeA, terceiro?.equipeB]).toEqual(['4º', '2º'])
  })

  it('o bronze sai sem esperar a final', () => {
    // A disputa de 3º lugar decide sozinha: segurar o bronze até o título
    // esconderia uma conquista que já aconteceu.
    const plano = montarMataMata(4)
    const slots = resolver(plano, ['1º', '2º', '3º', '4º'], {
      'R1-1': '1º',
      'R1-2': '3º',
      T: '2º',
    })
    const podio = podioDoMataMata([...slots.values()])
    expect(podio.terceiro).toBe('2º')
    expect(podio.campeao).toBeNull()
    expect(podio.vice).toBeNull()
  })

  it('quem perde a disputa de 3º lugar não recebe nada', () => {
    const plano = montarMataMata(4)
    const slots = resolver(plano, ['1º', '2º', '3º', '4º'], {
      'R1-1': '1º',
      'R1-2': '3º',
      T: '2º',
    })
    expect(podioDoMataMata([...slots.values()]).terceiro).toBe('2º')
  })
})

describe('grande final em melhor de 2', () => {
  const plano = montarMataMata(4)
  const equipes = ['1º', '2º', '3º', '4º']
  const semis = { 'R1-1': '1º', 'R1-2': '3º' }

  it('inverte os lados no segundo jogo', () => {
    const slots = resolver(plano, equipes, semis)
    expect([slots.get('F1')?.equipeA, slots.get('F1')?.equipeB]).toEqual(['1º', '3º'])
    expect([slots.get('F2')?.equipeA, slots.get('F2')?.equipeB]).toEqual(['3º', '1º'])
  })

  it('quem vence os dois jogos é campeão e o jogo 3 é dispensado', () => {
    const slots = resolver(plano, equipes, { ...semis, F1: '1º', F2: '1º' })
    expect(slots.get('F3')?.estado).toBe('DISPENSADO')
    const podio = podioDoMataMata([...slots.values()])
    expect(podio.campeao).toBe('1º')
    expect(podio.vice).toBe('3º')
  })

  it('série em 1 a 1 cria o jogo de desempate, e ninguém é campeão ainda', () => {
    const slots = resolver(plano, equipes, { ...semis, F1: '1º', F2: '3º' })
    expect(slots.get('F3')?.estado).toBe('PRONTO')
    expect([slots.get('F3')?.equipeA, slots.get('F3')?.equipeB]).toEqual(['1º', '3º'])
    expect(podioDoMataMata([...slots.values()]).campeao).toBeNull()
  })

  it('o jogo de desempate decide o título', () => {
    const slots = resolver(plano, equipes, { ...semis, F1: '1º', F2: '3º', F3: '3º' })
    const podio = podioDoMataMata([...slots.values()])
    expect(podio.campeao).toBe('3º')
    expect(podio.vice).toBe('1º')
  })

  it('o segundo jogo só nasce depois do primeiro estar definido', () => {
    const slots = resolver(plano, equipes, semis)
    // Os dois jogos da série são sempre disputados, então ambos já nascem
    // prontos assim que os finalistas são conhecidos.
    expect(slots.get('F1')?.estado).toBe('PRONTO')
    expect(slots.get('F2')?.estado).toBe('PRONTO')
    expect(slots.get('F3')?.estado).toBe('INDEFINIDO')
  })
})

describe('chave de 2 equipes', () => {
  it('decide o título na melhor de 2, sem bronze', () => {
    const plano = montarMataMata(3)
    const slots = resolver(plano, ['1º', '2º'], { F1: '2º', F2: '2º' })
    const podio = podioDoMataMata([...slots.values()])
    expect(podio.campeao).toBe('2º')
    expect(podio.vice).toBe('1º')
    expect(podio.terceiro).toBeNull()
  })
})

describe('confrontos prontos', () => {
  it('só lista o que já tem os dois lados e ainda não foi jogado', () => {
    const plano = montarMataMata(8)
    const equipes = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º']
    const prontos = confrontosProntosDeMataMata(
      resolverMataMata(plano, equipes, { vencedorPorSlot: new Map() }),
    )
    expect(prontos.map((s) => s.id)).toEqual(['R1-1', 'R1-2', 'R1-3', 'R1-4'])
  })
})

describe('integridade', () => {
  it('recusa um vencedor que não disputa o confronto', () => {
    const plano = montarMataMata(4)
    expect(() =>
      resolverMataMata(plano, ['1º', '2º', '3º', '4º'], {
        vencedorPorSlot: new Map([['R1-1', '2º']]),
      }),
    ).toThrow(/não disputa este confronto/)
  })
})
