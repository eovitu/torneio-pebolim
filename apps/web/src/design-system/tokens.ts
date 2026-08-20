/**
 * Tokens do design system — fonte de verdade visual do produto (§42).
 *
 * Identidade: mesa de pebolim. Verde de feltro como base institucional,
 * laranja da bola como acento de ação, dourado para liderança e gol de ouro,
 * vermelho reservado exclusivamente para "ao vivo" e para perigo.
 *
 * Nenhuma cor, medida, raio, sombra ou duração deve ser escrita à mão dentro
 * de um componente. Se falta um valor aqui, o certo é adicioná-lo aqui.
 *
 * Os nomes antigos (`accent`, `neutral`, `accentRamp`, `divider`, `muted`)
 * foram preservados de propósito: as telas que já existiam continuam
 * compilando e só ganham a paleta nova, sem reescrita cega.
 */

/** Verde de feltro — a mesa. Base institucional do produto. */
const campo = {
  50: '#eef6f1',
  100: '#d3e9dd',
  200: '#a6d3bc',
  300: '#6fb795',
  400: '#3f9a73',
  500: '#1f7d57',
  600: '#146345',
  700: '#0f4c35',
  800: '#0b3527',
  900: '#07231a',
} as const

/** Laranja da bola — ação, destaque, energia. */
const bola = {
  50: '#fff4ec',
  100: '#ffe3d1',
  200: '#ffc3a1',
  300: '#ff9c66',
  400: '#ff7a35',
  500: '#f2620f',
  600: '#d14c07',
  700: '#a63a06',
  800: '#7a2c08',
  900: '#4d1d06',
} as const

/** Neutros levemente esverdeados — combinam com o feltro sem parecer cinza. */
const neutral = {
  0: '#ffffff',
  50: '#f8faf8',
  100: '#f2f5f2',
  200: '#e4e9e5',
  300: '#d0d8d2',
  400: '#a9b5ad',
  500: '#7f8d84',
  600: '#5d6b62',
  700: '#414d46',
  800: '#28322c',
  900: '#141a17',
} as const

export const tokens = {
  color: {
    /* ---- superfícies ---- */
    bg: neutral[100],
    surface: neutral[0],
    surfaceAlt: neutral[50],
    surfaceSunken: neutral[200],
    /** Painéis escuros: cabeçalho, placar ao vivo, faixas de destaque. */
    surfaceDark: campo[800],
    surfaceDarkAlt: campo[700],

    /* ---- texto ---- */
    text: neutral[900],
    textSoft: neutral[700],
    muted: neutral[500],
    onDark: neutral[0],
    onDarkMuted: 'color-mix(in srgb, #ffffff 68%, transparent)',

    /* ---- linhas ---- */
    border: neutral[300],
    borderSoft: neutral[200],
    borderStrong: neutral[400],
    divider: neutral[200],

    /* ---- marca ---- */
    campo,
    bola,
    /** Acento primário de ação. */
    accent: bola[500],
    accent2: bola[400],
    /** Acento institucional (identidade, não ação). */
    marca: campo[700],
    marcaClara: campo[500],

    /* ---- estados ---- */
    aoVivo: '#e5484d',
    aoVivoSuave: '#fdecec',
    ouro: '#f5b021',
    ouroSuave: '#fff6e0',
    sucesso: '#1f9254',
    sucessoSuave: '#e7f6ed',
    aviso: '#b26a00',
    avisoSuave: '#fff4e0',
    perigo: '#c62828',
    perigoSuave: '#fdecec',
    info: '#2563eb',
    infoSuave: '#e8effd',

    neutral,
    /** Rampa do acento; mantida pelo nome antigo para não quebrar telas. */
    accentRamp: bola,
  },

  font: {
    heading: '"Archivo", system-ui, -apple-system, sans-serif',
    body: '"Archivo", system-ui, -apple-system, sans-serif',
    /** Números de placar e cronômetro: tabular, nunca dança na tela. */
    numero: '"Archivo", ui-monospace, system-ui, sans-serif',
    headingWeight: 800,
  },

  /** Escala tipográfica. Nada de font-size solto no componente. */
  fontSize: {
    micro: '10px',
    caption: '11px',
    small: '13px',
    body: '15px',
    lead: '17px',
    h4: '18px',
    h3: '22px',
    h2: '28px',
    h1: '34px',
    display: '46px',
    placar: '64px',
  },

  lineHeight: {
    tight: 1.1,
    snug: 1.3,
    normal: 1.55,
  },

  space: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    7: '28px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },

  /** Fim da quadradozidade: cada peça tem o raio do seu peso visual. */
  radius: {
    xs: '6px',
    sm: '10px',
    md: '16px',
    lg: '22px',
    xl: '30px',
    pill: '999px',
    circle: '50%',
  },

  shadow: {
    xs: '0 1px 2px rgba(11, 53, 39, 0.06)',
    sm: '0 2px 6px rgba(11, 53, 39, 0.07)',
    md: '0 6px 18px rgba(11, 53, 39, 0.09)',
    lg: '0 16px 40px rgba(11, 53, 39, 0.14)',
    /** Elevação de barra fixa, projetada para cima. */
    barra: '0 -6px 20px rgba(11, 53, 39, 0.10)',
    foco: '0 0 0 4px rgba(242, 98, 15, 0.28)',
  },

  motion: {
    rapido: '120ms',
    normal: '200ms',
    lento: '320ms',
    saida: 'cubic-bezier(0.4, 0, 1, 1)',
    entrada: 'cubic-bezier(0.16, 1, 0.3, 1)',
    padrao: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  layout: {
    /** Coluna estreita: formulários e telas de foco único. */
    appMaxWidth: '560px',
    /** Coluna de conteúdo geral. */
    contentMaxWidth: '1180px',
    /** Altura da barra inferior do celular. */
    barraMobile: '64px',
    /** Altura da barra superior. */
    barraTopo: '60px',
    /** Alvo de toque mínimo confortável (§43). */
    toque: '48px',
  },

  breakpoint: {
    sm: '480px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  },

  zIndex: {
    base: 1,
    barra: 20,
    dropdown: 30,
    overlay: 40,
    modal: 50,
    toast: 60,
  },
} as const

/** `@media` prontos — evita repetir a string do breakpoint em cada arquivo. */
export const midia = {
  sm: `@media (min-width: ${tokens.breakpoint.sm})`,
  md: `@media (min-width: ${tokens.breakpoint.md})`,
  lg: `@media (min-width: ${tokens.breakpoint.lg})`,
  xl: `@media (min-width: ${tokens.breakpoint.xl})`,
  /** Abaixo de `md` é onde vale a barra inferior e o layout de uma coluna. */
  ateMd: `@media (max-width: calc(${tokens.breakpoint.md} - 1px))`,
} as const

export type Tokens = typeof tokens
