import { createGlobalStyle } from 'styled-components'

/**
 * Reset mínimo e base tipográfica.
 *
 * `prefers-reduced-motion` desliga as animações globalmente — requisito de
 * acessibilidade do projeto, aplicado uma vez aqui em vez de componente a
 * componente.
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
    -webkit-text-size-adjust: 100%;
  }

  body {
    min-height: 100dvh;
  }

  h1, h2, h3, h4 {
    font-family: ${({ theme }) => theme.font.heading};
    font-weight: ${({ theme }) => theme.font.headingWeight};
    text-transform: uppercase;
    letter-spacing: -0.025em;
    margin: 0;
  }

  button,
  input,
  select,
  textarea {
    font-family: inherit;
  }

  a {
    color: ${({ theme }) => theme.color.accent};
  }

  :focus-visible {
    outline: 3px solid ${({ theme }) => theme.color.accent};
    outline-offset: 2px;
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
