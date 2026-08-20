/**
 * Rodízio de quem joga sozinho.
 *
 * A regra existe para uma coisa só: ninguém pode ficar sozinho o campeonato
 * inteiro. Por isso o teste central não é um caso isolado, e sim a simulação
 * de várias rodadas conferindo que o solo circula.
 */

import { describe, expect, it } from 'vitest'
import type { CandidatoAoRodizio, EquipeNoRodizio } from '../src/rodizio.js'
import { explicarRodizio, ordenarCandidatos, planejarRodizio } from '../src/rodizio.js'

function jogador(
  nome: string,
  partidasSozinho = 0,
  vezesComOSolitario = 0,
): CandidatoAoRodizio {
  return { playerId: nome.toLowerCase(), nome, partidasSozinho, vezesComOSolitario }
}

function equipe(nome: string, jogadores: CandidatoAoRodizio[]): EquipeNoRodizio {
  return { teamId: `t-${nome.toLowerCase()}`, nome, jogadores }
}

describe('planejarRodizio — o caso do proprietário', () => {
  it('a dupla que perdeu empresta e quem sobra fica sozinho', () => {
    const plano = planejarRodizio({
      perdedora: equipe('Alfa', [jogador('A', 2), jogador('B', 0)]),
      solitaria: equipe('Eco', [jogador('E', 3)]),
    })

    expect(plano).not.toBeNull()
    expect(plano?.vai.nome).toBe('A')
    expect(plano?.fica.nome).toBe('B')
    expect(plano?.paraEquipeNome).toBe('Eco')
    expect(plano?.deEquipeNome).toBe('Alfa')
  })

  it('vai quem JA ficou mais sozinho, nao quem ficou menos', () => {
    const plano = planejarRodizio({
      perdedora: equipe('Alfa', [jogador('CalouroSemSolo', 0), jogador('VeteranoSozinho', 5)]),
      solitaria: equipe('Eco', [jogador('E')]),
    })
    // Quem penou mais escapa do solo; a vez passa para quem nunca ficou.
    expect(plano?.vai.nome).toBe('VeteranoSozinho')
    expect(plano?.fica.nome).toBe('CalouroSemSolo')
  })

  it('empatados no solo, vai quem menos fez dupla com o solitario', () => {
    const plano = planejarRodizio({
      perdedora: equipe('Alfa', [jogador('Repetido', 1, 4), jogador('Novo', 1, 0)]),
      solitaria: equipe('Eco', [jogador('E')]),
    })
    expect(plano?.vai.nome).toBe('Novo')
  })

  it('empatados em tudo, resolve por nome — desempate tecnico e reproduzivel', () => {
    const a = planejarRodizio({
      perdedora: equipe('Alfa', [jogador('Zeca', 1, 1), jogador('Ana', 1, 1)]),
      solitaria: equipe('Eco', [jogador('E')]),
    })
    const b = planejarRodizio({
      perdedora: equipe('Alfa', [jogador('Ana', 1, 1), jogador('Zeca', 1, 1)]),
      solitaria: equipe('Eco', [jogador('E')]),
    })
    expect(a?.vai.nome).toBe('Ana')
    expect(b?.vai.nome).toBe('Ana')
  })
})

describe('planejarRodizio — quando nada acontece', () => {
  it('nao ha equipe de uma pessoa', () => {
    expect(
      planejarRodizio({
        perdedora: equipe('Alfa', [jogador('A'), jogador('B')]),
        solitaria: null,
      }),
    ).toBeNull()
  })

  it('a partida terminou empatada, entao nao ha perdedora', () => {
    expect(
      planejarRodizio({ perdedora: null, solitaria: equipe('Eco', [jogador('E')]) }),
    ).toBeNull()
  })

  it('quem perdeu foi a propria equipe de um', () => {
    const solitaria = equipe('Eco', [jogador('E')])
    expect(planejarRodizio({ perdedora: solitaria, solitaria })).toBeNull()
  })

  it('a perdedora tambem so tem uma pessoa, entao nao empresta', () => {
    expect(
      planejarRodizio({
        perdedora: equipe('Alfa', [jogador('A')]),
        solitaria: equipe('Eco', [jogador('E')]),
      }),
    ).toBeNull()
  })
})

describe('o solo circula ao longo do campeonato', () => {
  /**
   * O que a regra garante é isto: sempre que uma dupla perde, o solo TROCA de
   * mãos. Ela não garante equilíbrio perfeito entre todos — quem nunca perde
   * nunca entra na roda, e isso é consequência direta de "a cada partida
   * perdida, o time perdedor empresta um jogador".
   */
  it('quem estava sozinho nunca continua sozinho na rodada seguinte', () => {
    const solo = new Map<string, number>([
      ['A', 0],
      ['B', 0],
      ['C', 0],
      ['D', 0],
      ['E', 0],
    ])
    let equipes: string[][] = [
      ['A', 'B'],
      ['C', 'D'],
      ['E'],
    ]
    const passaramPeloSolo = new Set<string>()
    const candidato = (nome: string) => jogador(nome, solo.get(nome) ?? 0, 0)

    for (let rodada = 0; rodada < 12; rodada++) {
      const sozinhaAgora = equipes.find((e) => e.length === 1)
      expect(sozinhaAgora).toBeDefined()
      if (sozinhaAgora === undefined) break

      const quemEstavaSo = sozinhaAgora[0] as string
      passaramPeloSolo.add(quemEstavaSo)
      solo.set(quemEstavaSo, (solo.get(quemEstavaSo) ?? 0) + 1)

      const duplas = equipes.filter((e) => e.length === 2)
      const perdedoraLista = duplas[rodada % duplas.length]
      if (perdedoraLista === undefined) break

      const plano = planejarRodizio({
        perdedora: equipe('perdedora', perdedoraLista.map(candidato)),
        solitaria: equipe('solitaria', sozinhaAgora.map(candidato)),
      })
      expect(plano).not.toBeNull()
      if (plano === null) break

      equipes = equipes.map((e) => {
        if (e === perdedoraLista) return [plano.fica.nome]
        if (e === sozinhaAgora) return [...e, plano.vai.nome]
        return e
      })

      // A garantia central: quem acabou de ficar sozinho ganhou companhia.
      const novaSozinha = equipes.find((x) => x.length === 1)
      expect(novaSozinha?.[0]).not.toBe(quemEstavaSo)
    }

    // E o solo de fato circulou, em vez de ficar preso numa pessoa.
    expect(passaramPeloSolo.size).toBeGreaterThan(1)
  })

  it('a composicao nunca se degrada: sempre uma equipe de um e o resto duplas', () => {
    let equipes: string[][] = [
      ['A', 'B'],
      ['C', 'D'],
      ['E'],
    ]
    const candidato = (nome: string) => jogador(nome, 0, 0)

    for (let rodada = 0; rodada < 8; rodada++) {
      const sozinhaAgora = equipes.find((e) => e.length === 1)
      const perdedoraLista = equipes.filter((e) => e.length === 2)[0]
      if (sozinhaAgora === undefined || perdedoraLista === undefined) break

      const plano = planejarRodizio({
        perdedora: equipe('p', perdedoraLista.map(candidato)),
        solitaria: equipe('s', sozinhaAgora.map(candidato)),
      })
      if (plano === null) break

      equipes = equipes.map((e) => {
        if (e === perdedoraLista) return [plano.fica.nome]
        if (e === sozinhaAgora) return [...e, plano.vai.nome]
        return e
      })

      // Cinco pessoas continuam sendo cinco, em duas duplas e um sozinho.
      expect(equipes.flat()).toHaveLength(5)
      expect(new Set(equipes.flat()).size).toBe(5)
      expect(equipes.filter((e) => e.length === 1)).toHaveLength(1)
      expect(equipes.filter((e) => e.length === 2)).toHaveLength(2)
    }
  })
})

describe('ordenarCandidatos e explicacao', () => {
  it('ordena do mais indicado ao menos indicado', () => {
    const ordem = ordenarCandidatos([jogador('X', 0), jogador('Y', 3), jogador('Z', 1)])
    expect(ordem.map((c) => c.nome)).toEqual(['Y', 'Z', 'X'])
  })

  it('explica a escolha em portugues', () => {
    const plano = planejarRodizio({
      perdedora: equipe('Alfa', [jogador('A', 2), jogador('B', 0)]),
      solitaria: equipe('Eco', [jogador('E')]),
    })
    expect(explicarRodizio(plano!)).toContain('agora é a vez de B')
  })
})
