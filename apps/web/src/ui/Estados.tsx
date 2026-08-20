/**
 * Estados de tela: carregando, vazio, erro e sucesso (§20 do redesign).
 *
 * Toda tela importante usa estas peças, em vez de cada página inventar o seu
 * "Carregando…" solto. O vazio sempre carrega uma ação: uma tela vazia sem
 * saída é um beco.
 */

import type { ReactNode } from 'react'
import styled from 'styled-components'
import { AlertTriangle, CheckCircle2, Inbox } from 'lucide-react'
import { Cartao, Texto } from './Superficie'

/** Retângulo pulsante que ocupa o lugar do conteúdo enquanto ele não chega. */
export const Esqueleto = styled.div<{ $altura?: string; $largura?: string; $raio?: string }>`
  height: ${({ $altura = '16px' }) => $altura};
  width: ${({ $largura = '100%' }) => $largura};
  border-radius: ${({ theme, $raio }) => $raio ?? theme.radius.xs};
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.color.neutral[200]} 25%,
    ${({ theme }) => theme.color.neutral[100]} 37%,
    ${({ theme }) => theme.color.neutral[200]} 63%
  );
  background-size: 400% 100%;
  animation: pb-brilho 1.4s ease infinite;
`

const ListaEsqueleto = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};
`

/** Carregamento padrão de uma lista. */
export function Carregando({ linhas = 3, rotulo = 'Carregando…' }: { linhas?: number; rotulo?: string }) {
  return (
    <ListaEsqueleto role="status" aria-live="polite" aria-busy="true">
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {rotulo}
      </span>
      {Array.from({ length: linhas }, (_, i) => (
        <Esqueleto key={i} $altura="76px" $raio="16px" />
      ))}
    </ListaEsqueleto>
  )
}

const CaixaCentral = styled(Cartao)`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[8]} ${({ theme }) => theme.space[5]};
  border-style: dashed;
  border-color: ${({ theme }) => theme.color.border};
  background: ${({ theme }) => theme.color.surfaceAlt};

  h3 {
    font-size: ${({ theme }) => theme.fontSize.h4};
  }
`

const Circulo = styled.div`
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: ${({ theme }) => theme.radius.circle};
  background: ${({ theme }) => theme.color.campo[50]};
  color: ${({ theme }) => theme.color.campo[500]};
`

/** Estado vazio com chamada para ação. */
export function Vazio({
  titulo,
  descricao,
  acao,
  icone,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
  icone?: ReactNode
}) {
  return (
    <CaixaCentral $plano>
      <Circulo aria-hidden="true">{icone ?? <Inbox size={26} />}</Circulo>
      <h3>{titulo}</h3>
      {descricao !== undefined && (
        <Texto $pequeno $mudo>
          {descricao}
        </Texto>
      )}
      {acao}
    </CaixaCentral>
  )
}

const CaixaMensagem = styled.div<{ $tom: 'erro' | 'sucesso' | 'aviso' }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[4]};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.fontSize.small};
  border: 1px solid;
  animation: pb-surgir ${({ theme }) => theme.motion.normal} ${({ theme }) => theme.motion.entrada}
    both;

  background: ${({ theme, $tom }) =>
    $tom === 'erro'
      ? theme.color.perigoSuave
      : $tom === 'sucesso'
        ? theme.color.sucessoSuave
        : theme.color.avisoSuave};
  /* A borda acompanha a cor do texto: um tom só, definido logo abaixo. */
  border-color: color-mix(in srgb, currentColor 30%, transparent);
  color: ${({ theme, $tom }) =>
    $tom === 'erro'
      ? theme.color.perigo
      : $tom === 'sucesso'
        ? theme.color.sucesso
        : theme.color.aviso};

  svg {
    flex-shrink: 0;
    margin-top: 1px;
  }
`

/** Erro compreensível. `role="alert"` faz o leitor de tela anunciar na hora. */
export function Erro({ children }: { children: ReactNode }) {
  return (
    <CaixaMensagem $tom="erro" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>{children}</span>
    </CaixaMensagem>
  )
}

/** Confirmação de que a ação deu certo. */
export function Sucesso({ children }: { children: ReactNode }) {
  return (
    <CaixaMensagem $tom="sucesso" role="status">
      <CheckCircle2 size={18} aria-hidden="true" />
      <span>{children}</span>
    </CaixaMensagem>
  )
}

/** Aviso neutro, sem culpa de ninguém. */
export function Aviso({ children }: { children: ReactNode }) {
  return (
    <CaixaMensagem $tom="aviso" role="status">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>{children}</span>
    </CaixaMensagem>
  )
}
