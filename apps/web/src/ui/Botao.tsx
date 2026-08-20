/**
 * Botões do produto.
 *
 * Regra do projeto: se é uma ação, é um botão — nunca um texto sublinhado
 * (§4 do redesign). Por isso `BotaoLink` existe: navegar para "Ver torneio"
 * continua sendo um `<a>` de verdade (abre em nova aba, o teclado entende),
 * mas com a mesma aparência e o mesmo alvo de toque de um botão.
 *
 * Toda a diferença entre variantes é cor. Forma, altura e peso são iguais, de
 * modo que a hierarquia se lê pela cor e não por tamanho aleatório.
 */

import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { baseBotao } from './estilos'
import type { PropsVisuaisBotao, TamanhoBotao, VarianteBotao } from './estilos'

export type { PropsVisuaisBotao, TamanhoBotao, VarianteBotao }

export const Botao = styled.button<PropsVisuaisBotao>`
  ${baseBotao}
`

/** Ação que navega. Mesma aparência do botão, semântica de link. */
export const BotaoLink = styled(Link)<PropsVisuaisBotao>`
  ${baseBotao}
`

/** Link externo/âncora com aparência de botão. */
export const BotaoAncora = styled.a<PropsVisuaisBotao>`
  ${baseBotao}
`

/** Botão só de ícone. Exige `aria-label` — sem rótulo não existe ação. */
export const BotaoIcone = styled.button<PropsVisuaisBotao & { $redondo?: boolean }>`
  ${baseBotao}
  padding: 0;
  width: ${({ theme, $tamanho = 'md' }) => ($tamanho === 'sm' ? '38px' : theme.layout.toque)};
  min-width: ${({ theme, $tamanho = 'md' }) => ($tamanho === 'sm' ? '38px' : theme.layout.toque)};
  border-radius: ${({ theme, $redondo }) => ($redondo === true ? theme.radius.circle : theme.radius.sm)};
`

/** Grupo de ações. Empilha no celular, alinha em linha a partir de 480px. */
export const Acoes = styled.div<{ $fim?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};

  @media (min-width: ${({ theme }) => theme.breakpoint.sm}) {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: ${({ $fim }) => ($fim === true ? 'flex-end' : 'flex-start')};
  }
`
