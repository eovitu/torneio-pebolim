/**
 * Tokens do design system, portados do bundle gerado no Claude Design
 * (`project/_ds/modernist-.../styles.css`). Estética modernista: sem raio de
 * borda, réguas de 2px, tipografia Archivo em caixa-alta, um único acento.
 *
 * Esta é a fonte de verdade visual do app — nenhum valor de cor, espaçamento
 * ou sombra deve ser escrito à mão nos componentes.
 */

export const tokens = {
  color: {
    bg: '#f3f2f2',
    surface: '#eae9e9',
    text: '#201e1d',
    accent: '#ec3013',
    accent2: '#e15b47',
    divider: 'color-mix(in srgb, #201e1d 40%, transparent)',
    muted: 'color-mix(in srgb, #201e1d 55%, transparent)',
    neutral: {
      100: '#f8f4f4',
      200: '#eae7e7',
      300: '#d7d3d3',
      400: '#bab6b6',
      500: '#9b9797',
      600: '#7d7979',
      700: '#605d5d',
      800: '#444141',
      900: '#2d2b2b',
    },
    accentRamp: {
      100: '#fff2ef',
      200: '#ffe0d9',
      300: '#ffc4b8',
      400: '#ff9783',
      500: '#ff563c',
      600: '#dd2b0f',
      700: '#ae1800',
      800: '#7c1405',
      900: '#4d170e',
    },
  },
  font: {
    heading: '"Archivo", system-ui, sans-serif',
    body: '"Archivo", system-ui, sans-serif',
    headingWeight: 800,
  },
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    6: '24px',
    8: '32px',
  },
  radius: {
    sm: '0px',
    md: '0px',
    lg: '0px',
  },
  shadow: {
    sm: '0 1px 2px color-mix(in srgb, #2d2b2b 14%, transparent)',
    md: '0 3px 10px color-mix(in srgb, #2d2b2b 16%, transparent)',
    lg: '0 12px 32px color-mix(in srgb, #2d2b2b 22%, transparent)',
  },
  /** Largura da coluna central, herdada do protótipo mobile. */
  layout: {
    appMaxWidth: '560px',
    contentMaxWidth: '1120px',
  },
  breakpoint: {
    sm: '480px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  },
} as const

export type Tokens = typeof tokens
