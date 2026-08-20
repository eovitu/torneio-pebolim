import { createGlobalStyle } from 'styled-components'
import { midia } from './tokens'

/**
 * Reset mínimo, base tipográfica e as duas animações que o app inteiro
 * reutiliza (entrada de cartão e pulso de "ao vivo").
 *
 * `prefers-reduced-motion` desliga tudo de uma vez aqui, em vez de componente
 * a componente — requisito de acessibilidade do projeto (§17 do prompt, §41).
 */
export const GlobalStyle = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    background: ${({ theme }) => theme.color.bg};
    color: ${({ theme }) => theme.color.text};
    font-family: ${({ theme }) => theme.font.body};
    font-size: ${({ theme }) => theme.fontSize.body};
    line-height: ${({ theme }) => theme.lineHeight.normal};
    -webkit-text-size-adjust: 100%;
    -webkit-font-smoothing: antialiased;
  }

  body {
    min-height: 100dvh;
    /* Nunca rolar de lado: tabela larga rola dentro do próprio contêiner. */
    overflow-x: hidden;
  }

  #root {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  h1, h2, h3, h4 {
    font-family: ${({ theme }) => theme.font.heading};
    font-weight: ${({ theme }) => theme.font.headingWeight};
    letter-spacing: -0.02em;
    line-height: ${({ theme }) => theme.lineHeight.tight};
    margin: 0;
  }

  h1 { font-size: ${({ theme }) => theme.fontSize.h2}; }
  h2 { font-size: ${({ theme }) => theme.fontSize.h3}; }
  h3 { font-size: ${({ theme }) => theme.fontSize.h4}; }

  ${midia.md} {
    h1 { font-size: ${({ theme }) => theme.fontSize.h1}; }
  }

  p { margin: 0; }

  button,
  input,
  select,
  textarea {
    font-family: inherit;
  }

  a {
    color: ${({ theme }) => theme.color.marca};
    text-underline-offset: 3px;
  }

  img { max-width: 100%; }

  :focus-visible {
    outline: 3px solid ${({ theme }) => theme.color.accent};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radius.xs};
  }

  /* Entrada suave de cartão — usada por listas e painéis. */
  @keyframes pb-surgir {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: none; }
  }

  /* Pulso do indicador "ao vivo". */
  @keyframes pb-pulsar {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.45; transform: scale(0.82); }
  }

  /* Brilho do esqueleto de carregamento. */
  @keyframes pb-brilho {
    from { background-position: 200% 0; }
    to   { background-position: -200% 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`
