import { describe, expect, it } from 'vitest'
import {
  atingiuAMeta,
  descreverTermino,
  metaValida,
  regraEfetiva,
  REGRA_PADRAO,
} from '../src/termino.js'

describe('regra efetiva', () => {
  it('sem nada configurado, vale o padrão de 3 minutos', () => {
    expect(regraEfetiva(null, null)).toEqual(REGRA_PADRAO)
  })

  it('a partida herda a regra do torneio', () => {
    expect(regraEfetiva(null, { condicao: 'GOLS', golsParaVencer: 3 })).toEqual({
      condicao: 'GOLS',
      golsParaVencer: 3,
    })
  })

  it('a partida sobrescreve a regra do torneio', () => {
    expect(
      regraEfetiva({ condicao: 'GOLS', golsParaVencer: 2 }, { condicao: 'GOLS', golsParaVencer: 5 }),
    ).toEqual({ condicao: 'GOLS', golsParaVencer: 2 })
  })

  it('a partida pode voltar ao tempo mesmo com o torneio em gols', () => {
    expect(
      regraEfetiva({ condicao: 'TEMPO', golsParaVencer: null }, { condicao: 'GOLS', golsParaVencer: 3 }),
    ).toEqual(REGRA_PADRAO)
  })

  it('a partida em gols sem meta própria usa a meta do torneio', () => {
    expect(
      regraEfetiva({ condicao: 'GOLS', golsParaVencer: null }, { condicao: 'GOLS', golsParaVencer: 4 }),
    ).toEqual({ condicao: 'GOLS', golsParaVencer: 4 })
  })

  it('condição por gols sem meta nenhuma volta ao tempo', () => {
    // Configuração pela metade não é regra: o tempo sempre sabe terminar.
    expect(regraEfetiva(null, { condicao: 'GOLS', golsParaVencer: null })).toEqual(REGRA_PADRAO)
  })
})

describe('meta de gols', () => {
  it('aceita metas plausíveis e recusa o resto', () => {
    expect(metaValida(1)).toBe(true)
    expect(metaValida(3)).toBe(true)
    expect(metaValida(20)).toBe(true)
    expect(metaValida(0)).toBe(false)
    expect(metaValida(21)).toBe(false)
    expect(metaValida(2.5)).toBe(false)
  })
})

describe('atingiu a meta', () => {
  const porGols = { condicao: 'GOLS' as const, golsParaVencer: 3 }

  it('encerra quando qualquer lado chega à meta', () => {
    expect(atingiuAMeta(porGols, 3, 1)).toBe(true)
    expect(atingiuAMeta(porGols, 0, 3)).toBe(true)
  })

  it('não encerra antes da meta', () => {
    expect(atingiuAMeta(porGols, 2, 2)).toBe(false)
  })

  it('gol de goleiro pode passar da meta, e ainda encerra', () => {
    // O placar é ponderado: 2 + 2 = 4 estoura a meta de 3 num gol só.
    expect(atingiuAMeta(porGols, 4, 1)).toBe(true)
  })

  it('na condição por tempo o placar nunca encerra a partida', () => {
    expect(atingiuAMeta(REGRA_PADRAO, 99, 0)).toBe(false)
  })
})

describe('descrição', () => {
  it('diz a regra em uma linha', () => {
    expect(descreverTermino(REGRA_PADRAO)).toBe('Termina em 3 minutos')
    expect(descreverTermino({ condicao: 'GOLS', golsParaVencer: 5 })).toBe('Termina com 5 gols')
  })
})
