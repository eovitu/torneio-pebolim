/**
 * Troféus do pódio, como aparecem no perfil do jogador.
 *
 * O banco guarda só o essencial — torneio, equipe, posição e a SKIN escolhida
 * pelo admin. O desenho vive aqui, que é onde ele pertence: mudar a cara de um
 * troféu não é migração de dados (§45).
 *
 * A hierarquia visual é a própria regra: o ouro é o único com brilho e
 * moldura cheia, a prata é claramente mais sóbria, e o bronze é o mais simples
 * dos três. Quem fica em 4º não tem troféu nenhum, então não há um quarto tom.
 *
 * Acessibilidade: a posição está escrita por extenso em todo troféu, nunca só
 * na cor (§17 do redesign).
 */

import styled, { css, keyframes } from 'styled-components'
import { Award, Medal, Target, Trophy } from 'lucide-react'
import { midia } from '../design-system/tokens'
import { METAL_TROFEU, ROTULO_TROFEU } from '../dados/trofeus'
import type { PosicaoDeTrofeu, SkinDeTrofeu, TrofeuExibido } from '../dados/trofeus'

/**
 * A skin muda o par de cores de cada metal e a textura do fundo. O ouro é
 * sempre o mais quente e saturado da paleta, para que a hierarquia sobreviva a
 * qualquer skin que o admin escolha.
 */
const PALETA: Record<SkinDeTrofeu, Record<PosicaoDeTrofeu, { de: string; para: string; tinta: string }>> = {
  CLASSICO: {
    CAMPEAO: { de: '#f7d774', para: '#c9922a', tinta: '#5b3d05' },
    VICE: { de: '#e3e8ec', para: '#a8b3ba', tinta: '#3f4a51' },
    TERCEIRO: { de: '#e2b48c', para: '#a5673a', tinta: '#4d2a12' },
    ARTILHEIRO: { de: '#ffd0a3', para: '#e07a26', tinta: '#4d2405' },
  },
  NEON: {
    CAMPEAO: { de: '#ffe259', para: '#ff9a00', tinta: '#4a2500' },
    VICE: { de: '#c9f7ff', para: '#5ec8e0', tinta: '#124450' },
    TERCEIRO: { de: '#ffb7a0', para: '#e0644a', tinta: '#4f180d' },
    ARTILHEIRO: { de: '#d6b4ff', para: '#8a3ff0', tinta: '#2b0a55' },
  },
  RETRO: {
    CAMPEAO: { de: '#e8c56a', para: '#a97c1e', tinta: '#4a340a' },
    VICE: { de: '#d6d3c9', para: '#9a978d', tinta: '#403e38' },
    TERCEIRO: { de: '#cfa383', para: '#8f5f3c', tinta: '#402512' },
    ARTILHEIRO: { de: '#cfd9b4', para: '#7d8f4e', tinta: '#2f3a16' },
  },
  BOTECO: {
    CAMPEAO: { de: '#ffd86b', para: '#d4901f', tinta: '#523404' },
    VICE: { de: '#dfe6e0', para: '#9faea3', tinta: '#39463c' },
    TERCEIRO: { de: '#d9a97f', para: '#93613a', tinta: '#3f2814' },
    ARTILHEIRO: { de: '#ffc9a6', para: '#d4622a', tinta: '#4a1c06' },
  },
}

const ICONE = {
  CAMPEAO: Trophy,
  VICE: Medal,
  TERCEIRO: Award,
  ARTILHEIRO: Target,
} as const

const brilho = keyframes`
  0%, 100% { transform: translateX(-120%) rotate(18deg); }
  55%, 99% { transform: translateX(320%) rotate(18deg); }
`

const Cartao = styled.article<{ $de: string; $para: string; $tinta: string; $posicao: PosicaoDeTrofeu }>`
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[3]} ${({ theme }) => theme.space[4]};
  border-radius: ${({ theme }) => theme.radius.md};
  color: ${({ $tinta }) => $tinta};
  background: linear-gradient(135deg, ${({ $de }) => $de}, ${({ $para }) => $para});

  /*
    Moldura cheia para o campeão e para o artilheiro: um é o degrau mais alto,
    o outro é a única premiação individual do torneio. Vice e bronze ficam com
    a borda discreta, que é o que os mantém visivelmente abaixo do ouro.
  */
  ${({ $posicao, $para }) =>
    $posicao === 'CAMPEAO' || $posicao === 'ARTILHEIRO'
      ? css`
          border: 2px solid ${$para};
          box-shadow: 0 6px 22px -10px ${$para};
        `
      : css`
          border: 1px solid rgba(0, 0, 0, 0.12);
        `}

  /* E só ele tem o lampejo passando por cima. */
  ${({ $posicao }) =>
    $posicao === 'CAMPEAO' &&
    css`
      &::after {
        content: '';
        position: absolute;
        inset: -40% auto -40% 0;
        width: 40%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
        animation: ${brilho} 4.5s ease-in-out infinite;
        pointer-events: none;
      }

      @media (prefers-reduced-motion: reduce) {
        &::after {
          animation: none;
          opacity: 0;
        }
      }
    `}
`

const Icone = styled.div<{ $posicao: PosicaoDeTrofeu }>`
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: ${({ $posicao }) => ($posicao === 'CAMPEAO' || $posicao === 'ARTILHEIRO' ? '48px' : '40px')};
  height: ${({ $posicao }) => ($posicao === 'CAMPEAO' || $posicao === 'ARTILHEIRO' ? '48px' : '40px')};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: rgba(255, 255, 255, 0.45);
`

const Texto = styled.div`
  min-width: 0;
  flex: 1 1 auto;

  strong {
    display: block;
    font-size: ${({ theme }) => theme.fontSize.body};
    font-weight: 800;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  span {
    display: block;
    font-size: ${({ theme }) => theme.fontSize.micro};
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.78;
  }

  small {
    display: block;
    margin-top: 2px;
    font-size: ${({ theme }) => theme.fontSize.caption};
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const Grade = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[3]};

  ${midia.md} {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
`

/**
 * Ouro antes de prata, prata antes de bronze — a estante segue o pódio. O
 * artilheiro vem por último não por valer menos, mas por ser outra categoria:
 * misturá-lo no meio dos degraus faria parecer um 4º lugar.
 */
const PESO: Record<PosicaoDeTrofeu, number> = {
  CAMPEAO: 0,
  VICE: 1,
  TERCEIRO: 2,
  ARTILHEIRO: 3,
}

export function Trofeus({ trofeus }: { trofeus: readonly TrofeuExibido[] }) {
  const ordenados = [...trofeus].sort(
    (a, b) => PESO[a.posicao] - PESO[b.posicao] || a.nomeDoTorneio.localeCompare(b.nomeDoTorneio, 'pt-BR'),
  )

  return (
    <Grade>
      {ordenados.map((t) => {
        const cores = PALETA[t.skin][t.posicao]
        const Glifo = ICONE[t.posicao]
        return (
          <Cartao
            key={t.id}
            $de={cores.de}
            $para={cores.para}
            $tinta={cores.tinta}
            $posicao={t.posicao}
          >
            <Icone $posicao={t.posicao}>
              <Glifo
                size={t.posicao === 'CAMPEAO' || t.posicao === 'ARTILHEIRO' ? 26 : 21}
                strokeWidth={2.2}
              />
            </Icone>
            <Texto>
              <span>
                {ROTULO_TROFEU[t.posicao]} · {METAL_TROFEU[t.posicao]}
              </span>
              <strong>{t.nomeDoTorneio}</strong>
              <small>{t.nomeDaEquipe}</small>
            </Texto>
          </Cartao>
        )
      })}
    </Grade>
  )
}
