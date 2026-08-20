/**
 * Superfícies e blocos de layout.
 *
 * O redesign pede que a página respire: nem tudo é cartão flutuante. Por isso
 * existem três pesos diferentes — `Cartao` (peça destacada), `Bloco` (área
 * aberta com divisor) e `Painel` (superfície escura de destaque) — em vez de
 * uma caixa única repetida na tela inteira (§3 do redesign).
 */

import styled from 'styled-components'
import { midia } from '../design-system/tokens'

/** Coluna de conteúdo da página. Deixa espaço para a barra inferior no celular. */
export const Pagina = styled.main<{ $estreita?: boolean }>`
  flex: 1;
  width: 100%;
  max-width: ${({ theme, $estreita }) =>
    $estreita === true ? theme.layout.appMaxWidth : theme.layout.contentMaxWidth};
  margin: 0 auto;
  padding: ${({ theme }) => theme.space[4]};
  padding-bottom: calc(${({ theme }) => theme.layout.barraMobile} + ${({ theme }) => theme.space[10]});
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[6]};

  ${midia.md} {
    padding: ${({ theme }) => theme.space[8]} ${({ theme }) => theme.space[6]};
    padding-bottom: ${({ theme }) => theme.space[12]};
    gap: ${({ theme }) => theme.space[8]};
  }
`

/** Cartão: a peça com contorno próprio. */
export const Cartao = styled.section<{ $plano?: boolean; $compacto?: boolean }>`
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: ${({ theme, $compacto }) => ($compacto === true ? theme.space[4] : theme.space[5])};
  box-shadow: ${({ theme, $plano }) => ($plano === true ? 'none' : theme.shadow.xs)};
  animation: pb-surgir ${({ theme }) => theme.motion.lento} ${({ theme }) => theme.motion.entrada}
    both;
`

/** Superfície escura de destaque: placar ao vivo, cabeçalho de torneio. */
export const Painel = styled.section`
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    145deg,
    ${({ theme }) => theme.color.campo[800]} 0%,
    ${({ theme }) => theme.color.campo[700]} 55%,
    ${({ theme }) => theme.color.campo[600]} 100%
  );
  color: ${({ theme }) => theme.color.onDark};
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: ${({ theme }) => theme.space[5]};
  box-shadow: ${({ theme }) => theme.shadow.md};

  /* Linha central da mesa: a identidade aparece sem custar nenhum asset. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.05) 0 1px,
        transparent 1px 42px
      );
    opacity: 0.6;
  }

  > * {
    position: relative;
    z-index: 1;
  }

  ${midia.md} {
    padding: ${({ theme }) => theme.space[7]};
  }
`

/** Área aberta com título — sem caixa, para o layout não virar só cartão. */
export const Bloco = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`

/** Cabeçalho de seção: título à esquerda, ação à direita. */
export const TituloSecao = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
  flex-wrap: wrap;

  h2 {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space[2]};
  }
`

/** Texto pequeno em caixa alta que rotula um grupo. */
export const Rotulo = styled.p<{ $cor?: 'acento' | 'marca' | 'mudo' }>`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.micro};
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${({ theme, $cor = 'mudo' }) =>
    $cor === 'acento'
      ? theme.color.accent
      : $cor === 'marca'
        ? theme.color.marcaClara
        : theme.color.muted};
`

/** Texto auxiliar. */
export const Texto = styled.p<{ $pequeno?: boolean; $mudo?: boolean; $claro?: boolean }>`
  margin: 0;
  font-size: ${({ theme, $pequeno }) =>
    $pequeno === true ? theme.fontSize.small : theme.fontSize.body};
  color: ${({ theme, $mudo, $claro }) =>
    $claro === true ? theme.color.onDarkMuted : $mudo === true ? theme.color.muted : theme.color.textSoft};
`

/** Grade responsiva de cartões. */
export const Grade = styled.div<{ $min?: string }>`
  display: grid;
  gap: ${({ theme }) => theme.space[4]};
  grid-template-columns: 1fr;

  @media (min-width: ${({ theme }) => theme.breakpoint.sm}) {
    grid-template-columns: repeat(auto-fill, minmax(${({ $min = '260px' }) => $min}, 1fr));
  }
`

/** Divisor discreto. */
export const Divisor = styled.hr`
  border: 0;
  border-top: 1px solid ${({ theme }) => theme.color.borderSoft};
  margin: ${({ theme }) => theme.space[5]} 0;
  width: 100%;
`

/** Contêiner que rola de lado sozinho — tabela larga nunca empurra a página. */
export const RolagemHorizontal = styled.div`
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 0 -${({ theme }) => theme.space[4]};
  padding: 0 ${({ theme }) => theme.space[4]};

  ${midia.md} {
    margin: 0;
    padding: 0;
  }
`
