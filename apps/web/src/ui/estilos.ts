/**
 * Fragmentos de CSS compartilhados entre componentes.
 *
 * Vivem fora dos arquivos de componente porque o Fast Refresh do Vite exige
 * que um módulo de componente exporte apenas componentes — misturar os dois
 * derruba a atualização em tempo real durante o desenvolvimento.
 */

import { css } from 'styled-components'

export type VarianteBotao = 'primario' | 'secundario' | 'contorno' | 'fantasma' | 'perigo' | 'claro'
export type TamanhoBotao = 'sm' | 'md' | 'lg'

export interface PropsVisuaisBotao {
  $variante?: VarianteBotao
  $tamanho?: TamanhoBotao
  /** Ocupa a largura toda — o padrão no celular. */
  $bloco?: boolean
}

const tamanhos = {
  sm: css`
    min-height: 38px;
    padding: 0 ${({ theme }) => theme.space[3]};
    font-size: ${({ theme }) => theme.fontSize.caption};
    border-radius: ${({ theme }) => theme.radius.sm};
  `,
  md: css`
    min-height: ${({ theme }) => theme.layout.toque};
    padding: 0 ${({ theme }) => theme.space[5]};
    font-size: ${({ theme }) => theme.fontSize.small};
    border-radius: ${({ theme }) => theme.radius.sm};
  `,
  lg: css`
    min-height: 56px;
    padding: 0 ${({ theme }) => theme.space[6]};
    font-size: ${({ theme }) => theme.fontSize.body};
    border-radius: ${({ theme }) => theme.radius.md};
  `,
}

const variantes = {
  primario: css`
    background: ${({ theme }) => theme.color.accent};
    border-color: ${({ theme }) => theme.color.accent};
    color: ${({ theme }) => theme.color.onDark};
    box-shadow: ${({ theme }) => theme.shadow.sm};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.color.bola[600]};
      border-color: ${({ theme }) => theme.color.bola[600]};
    }
  `,
  secundario: css`
    background: ${({ theme }) => theme.color.marca};
    border-color: ${({ theme }) => theme.color.marca};
    color: ${({ theme }) => theme.color.onDark};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.color.campo[800]};
      border-color: ${({ theme }) => theme.color.campo[800]};
    }
  `,
  contorno: css`
    background: ${({ theme }) => theme.color.surface};
    border-color: ${({ theme }) => theme.color.border};
    color: ${({ theme }) => theme.color.text};

    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.color.marcaClara};
      background: ${({ theme }) => theme.color.campo[50]};
    }
  `,
  fantasma: css`
    background: transparent;
    border-color: transparent;
    color: ${({ theme }) => theme.color.textSoft};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.color.surfaceSunken};
      color: ${({ theme }) => theme.color.text};
    }
  `,
  perigo: css`
    background: ${({ theme }) => theme.color.perigo};
    border-color: ${({ theme }) => theme.color.perigo};
    color: ${({ theme }) => theme.color.onDark};

    &:hover:not(:disabled) {
      background: #a51f1f;
      border-color: #a51f1f;
    }
  `,
  /** Para usar sobre painel escuro. */
  claro: css`
    background: rgba(255, 255, 255, 0.14);
    border-color: rgba(255, 255, 255, 0.28);
    color: ${({ theme }) => theme.color.onDark};

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.24);
    }
  `,
}

export const baseBotao = css<PropsVisuaisBotao>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.font.body};
  font-weight: 700;
  letter-spacing: 0.02em;
  text-decoration: none;
  white-space: nowrap;
  border: 2px solid transparent;
  cursor: pointer;
  transition:
    background ${({ theme }) => theme.motion.rapido} ${({ theme }) => theme.motion.padrao},
    border-color ${({ theme }) => theme.motion.rapido} ${({ theme }) => theme.motion.padrao},
    transform ${({ theme }) => theme.motion.rapido} ${({ theme }) => theme.motion.padrao},
    box-shadow ${({ theme }) => theme.motion.rapido} ${({ theme }) => theme.motion.padrao};

  ${({ $tamanho = 'md' }) => tamanhos[$tamanho]}
  ${({ $variante = 'primario' }) => variantes[$variante]}
  ${({ $bloco }) =>
    $bloco === true &&
    css`
      width: 100%;
    `}

  /* Retorno tátil: o botão afunda no toque. */
  &:active:not(:disabled) {
    transform: translateY(1px) scale(0.985);
  }

  &:disabled,
  &[aria-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.5;
    box-shadow: none;
  }

  svg {
    flex-shrink: 0;
  }
`

/** Cartão que reage ao ponteiro — usado quando o cartão inteiro é clicável. */
export const cartaoInterativo = css`
  transition:
    transform ${({ theme }) => theme.motion.normal} ${({ theme }) => theme.motion.padrao},
    box-shadow ${({ theme }) => theme.motion.normal} ${({ theme }) => theme.motion.padrao},
    border-color ${({ theme }) => theme.motion.normal} ${({ theme }) => theme.motion.padrao};

  @media (hover: hover) {
    &:hover {
      transform: translateY(-2px);
      box-shadow: ${({ theme }) => theme.shadow.md};
      border-color: ${({ theme }) => theme.color.campo[200]};
    }
  }

  &:active {
    transform: translateY(0);
  }
`
