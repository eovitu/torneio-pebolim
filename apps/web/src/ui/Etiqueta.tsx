/**
 * Etiquetas, distintivos e avatares.
 *
 * Acessibilidade: nenhuma informação é transmitida só pela cor (§17 do
 * redesign). Toda etiqueta carrega texto, e o "ao vivo" tem também o ponto
 * pulsante e a palavra escrita.
 */

import styled, { css } from 'styled-components'

export type TomBadge =
  | 'neutro'
  | 'marca'
  | 'acento'
  | 'aoVivo'
  | 'ouro'
  | 'sucesso'
  | 'aviso'
  | 'perigo'
  | 'info'
  | 'claro'

const tons = {
  neutro: css`
    background: ${({ theme }) => theme.color.surfaceSunken};
    color: ${({ theme }) => theme.color.textSoft};
  `,
  marca: css`
    background: ${({ theme }) => theme.color.campo[50]};
    color: ${({ theme }) => theme.color.campo[700]};
  `,
  acento: css`
    background: ${({ theme }) => theme.color.bola[50]};
    color: ${({ theme }) => theme.color.bola[700]};
  `,
  aoVivo: css`
    background: ${({ theme }) => theme.color.aoVivo};
    color: #fff;
  `,
  ouro: css`
    background: ${({ theme }) => theme.color.ouroSuave};
    color: #8a5a00;
  `,
  sucesso: css`
    background: ${({ theme }) => theme.color.sucessoSuave};
    color: ${({ theme }) => theme.color.sucesso};
  `,
  aviso: css`
    background: ${({ theme }) => theme.color.avisoSuave};
    color: ${({ theme }) => theme.color.aviso};
  `,
  perigo: css`
    background: ${({ theme }) => theme.color.perigoSuave};
    color: ${({ theme }) => theme.color.perigo};
  `,
  info: css`
    background: ${({ theme }) => theme.color.infoSuave};
    color: ${({ theme }) => theme.color.info};
  `,
  claro: css`
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
  `,
}

export const Badge = styled.span<{ $tom?: TomBadge }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  padding: 3px ${({ theme }) => theme.space[2]};
  border-radius: ${({ theme }) => theme.radius.pill};
  font-size: ${({ theme }) => theme.fontSize.micro};
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  line-height: 1.6;

  ${({ $tom = 'neutro' }) => tons[$tom]}
`

/** Ponto pulsante do "ao vivo". Sempre acompanhado da palavra. */
export const PontoAoVivo = styled.span`
  width: 7px;
  height: 7px;
  border-radius: ${({ theme }) => theme.radius.circle};
  background: currentColor;
  animation: pb-pulsar 1.4s ease-in-out infinite;
`

const tamanhosAvatar = { xs: 28, sm: 36, md: 48, lg: 72, xl: 104 } as const
export type TamanhoAvatar = keyof typeof tamanhosAvatar

const molduraAvatar = css<{ $tamanho?: TamanhoAvatar }>`
  width: ${({ $tamanho = 'md' }) => tamanhosAvatar[$tamanho]}px;
  height: ${({ $tamanho = 'md' }) => tamanhosAvatar[$tamanho]}px;
  min-width: ${({ $tamanho = 'md' }) => tamanhosAvatar[$tamanho]}px;
  border-radius: ${({ theme }) => theme.radius.circle};
  object-fit: cover;
  background: ${({ theme }) => theme.color.campo[100]};
  border: 2px solid ${({ theme }) => theme.color.surface};
  box-shadow: ${({ theme }) => theme.shadow.xs};
`

const Imagem = styled.img<{ $tamanho?: TamanhoAvatar }>`
  ${molduraAvatar}
  display: block;
`

const Iniciais = styled.span<{ $tamanho?: TamanhoAvatar }>`
  ${molduraAvatar}
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.font.heading};
  font-weight: 800;
  color: ${({ theme }) => theme.color.campo[700]};
  font-size: ${({ $tamanho = 'md' }) => Math.round(tamanhosAvatar[$tamanho] * 0.38)}px;
  letter-spacing: 0;
  user-select: none;
`

function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase()
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase()
}

/**
 * Foto do jogador/time. Sem foto, mostra as iniciais — nunca um quadrado
 * cinza vazio, que é o que fazia a lista parecer quebrada.
 */
export function Avatar({
  nome,
  url,
  tamanho = 'md',
}: {
  nome: string
  url?: string | null
  tamanho?: TamanhoAvatar
}) {
  if (url !== null && url !== undefined && url !== '') {
    return <Imagem src={url} alt="" $tamanho={tamanho} loading="lazy" decoding="async" />
  }
  return (
    <Iniciais $tamanho={tamanho} aria-hidden="true">
      {iniciaisDe(nome)}
    </Iniciais>
  )
}

/** Pilha de avatares sobrepostos — elenco de um time em pouco espaço. */
export const PilhaAvatares = styled.div`
  display: flex;

  > * + * {
    margin-left: -10px;
  }
`
