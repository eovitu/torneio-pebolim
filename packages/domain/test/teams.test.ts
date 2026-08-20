/**
 * Formação das equipes pelo número de participantes.
 *
 * Os seis primeiros casos são os exemplos que o proprietário deu por escrito.
 * Eles ficam aqui literalmente porque são a definição da regra, não uma
 * amostra dela.
 */

import { describe, expect, it } from 'vitest'
import {
  MAX_JOGADORES_POR_EQUIPE,
  comporEquipes,
  descreverComposicao,
  temEquipeSozinha,
} from '../src/teams.js'

describe('comporEquipes — exemplos oficiais', () => {
  it('2 pessoas viram 2 equipes de 1', () => {
    expect(comporEquipes(2)).toMatchObject({ duplas: 0, solos: 2, equipes: 2 })
  })

  it('3 pessoas viram 3 equipes de 1', () => {
    expect(comporEquipes(3)).toMatchObject({ duplas: 0, solos: 3, equipes: 3 })
  })

  it('4 pessoas viram 2 duplas', () => {
    expect(comporEquipes(4)).toMatchObject({ duplas: 2, solos: 0, equipes: 2 })
  })

  it('5 pessoas viram 2 duplas e 1 sozinho', () => {
    expect(comporEquipes(5)).toMatchObject({ duplas: 2, solos: 1, equipes: 3 })
  })

  it('6 pessoas viram 3 duplas', () => {
    expect(comporEquipes(6)).toMatchObject({ duplas: 3, solos: 0, equipes: 3 })
  })

  it('7 pessoas viram 3 duplas e 1 sozinho', () => {
    expect(comporEquipes(7)).toMatchObject({ duplas: 3, solos: 1, equipes: 4 })
  })
})

describe('comporEquipes — invariantes', () => {
  it('nunca deixa ninguém de fora', () => {
    for (let n = 2; n <= 40; n++) {
      const c = comporEquipes(n)
      const alocados = c.tamanhos.reduce((soma, t) => soma + t, 0)
      expect(alocados).toBe(n)
    }
  })

  it('nunca põe mais de duas pessoas numa equipe', () => {
    for (let n = 2; n <= 40; n++) {
      for (const tamanho of comporEquipes(n).tamanhos) {
        expect(tamanho).toBeGreaterThanOrEqual(1)
        expect(tamanho).toBeLessThanOrEqual(MAX_JOGADORES_POR_EQUIPE)
      }
    }
  })

  it('sempre forma ao menos duas equipes, senão não há confronto', () => {
    for (let n = 2; n <= 40; n++) {
      expect(comporEquipes(n).equipes).toBeGreaterThanOrEqual(2)
    }
  })

  it('deixa no máximo uma pessoa sozinha quando há duplas', () => {
    for (let n = 4; n <= 40; n++) {
      const c = comporEquipes(n)
      if (c.duplas > 0) expect(c.solos).toBeLessThanOrEqual(1)
    }
  })

  it('só dispensa as duplas quando não daria para formar duas', () => {
    expect(comporEquipes(2).duplas).toBe(0)
    expect(comporEquipes(3).duplas).toBe(0)
    for (let n = 4; n <= 40; n++) {
      expect(comporEquipes(n).duplas).toBeGreaterThanOrEqual(2)
    }
  })

  it('a lista de tamanhos bate com a contagem de duplas e solos', () => {
    for (let n = 2; n <= 40; n++) {
      const c = comporEquipes(n)
      expect(c.tamanhos.filter((t) => t === 2)).toHaveLength(c.duplas)
      expect(c.tamanhos.filter((t) => t === 1)).toHaveLength(c.solos)
      expect(c.tamanhos).toHaveLength(c.equipes)
    }
  })
})

describe('comporEquipes — recusas', () => {
  it('recusa menos de dois participantes', () => {
    expect(() => comporEquipes(1)).toThrow(/ao menos 2/)
    expect(() => comporEquipes(0)).toThrow(/ao menos 2/)
  })

  it('recusa número quebrado', () => {
    expect(() => comporEquipes(4.5)).toThrow(/inteiro/)
  })
})

describe('apresentação', () => {
  it('descreve a composição em português', () => {
    expect(descreverComposicao(comporEquipes(5))).toBe('3 equipes — 2 duplas e 1 jogando sozinho')
    expect(descreverComposicao(comporEquipes(4))).toBe('2 equipes — 2 duplas')
    expect(descreverComposicao(comporEquipes(3))).toBe('3 equipes — 3 jogando sozinhos')
  })

  it('avisa quando alguém enfrentará duplas sozinho', () => {
    expect(temEquipeSozinha(comporEquipes(5))).toBe(true)
    expect(temEquipeSozinha(comporEquipes(4))).toBe(false)
    // Todo mundo sozinho é parelho: ninguém está em desvantagem.
    expect(temEquipeSozinha(comporEquipes(3))).toBe(false)
  })
})
