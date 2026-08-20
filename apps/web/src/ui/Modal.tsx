/**
 * Modal e diálogo de confirmação.
 *
 * Fecha no Esc e no clique fora, devolve o foco para onde estava e trava a
 * rolagem do fundo — o mínimo para um modal não ser uma armadilha de teclado.
 *
 * `Confirmacao` tem um modo forte: exige digitar um texto exato antes de
 * liberar o botão. É o que protege "Excluir torneio" (§14 do redesign).
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styled from 'styled-components'
import { X } from 'lucide-react'
import { Acoes, Botao, BotaoIcone } from './Botao'
import { Texto } from './Superficie'
import { Entrada, Campo } from '../components/Formulario'

const Fundo = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.zIndex.modal};
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  background: rgba(7, 35, 26, 0.55);
  backdrop-filter: blur(3px);
  animation: pb-surgir ${({ theme }) => theme.motion.rapido} ease both;

  @media (min-width: ${({ theme }) => theme.breakpoint.sm}) {
    align-items: center;
    padding: ${({ theme }) => theme.space[4]};
  }
`

const Caixa = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: ${({ theme }) => theme.layout.appMaxWidth};
  max-height: 92dvh;
  background: ${({ theme }) => theme.color.surface};
  /* Folha inferior no celular, cartão centralizado no desktop. */
  border-radius: ${({ theme }) => theme.radius.lg} ${({ theme }) => theme.radius.lg} 0 0;
  box-shadow: ${({ theme }) => theme.shadow.lg};
  animation: pb-surgir ${({ theme }) => theme.motion.normal}
    ${({ theme }) => theme.motion.entrada} both;

  @media (min-width: ${({ theme }) => theme.breakpoint.sm}) {
    border-radius: ${({ theme }) => theme.radius.lg};
  }
`

const Cabecalho = styled.header`
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[5]};
  border-bottom: 1px solid ${({ theme }) => theme.color.borderSoft};

  h2 {
    flex: 1;
    font-size: ${({ theme }) => theme.fontSize.h3};
  }
`

const Corpo = styled.div`
  /* Ver ModalRegras: sem "min-height: 0" o corpo nao encolhe, a caixa estoura
     a altura maxima e o rodape sai da tela. */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: ${({ theme }) => theme.space[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`

const Rodape = styled.footer`
  flex-shrink: 0;
  padding: ${({ theme }) => theme.space[5]};
  border-top: 1px solid ${({ theme }) => theme.color.borderSoft};
`

export interface PropsModal {
  aberto: boolean
  titulo: string
  aoFechar: () => void
  children?: ReactNode
  rodape?: ReactNode
}

export function Modal({ aberto, titulo, aoFechar, children, rodape }: PropsModal) {
  const idTitulo = useId()
  const caixaRef = useRef<HTMLDivElement>(null)
  const focoAnterior = useRef<HTMLElement | null>(null)

  /**
   * Abertura e fechamento. Depende SÓ de `aberto`, de propósito.
   *
   * Antes este efeito dependia também de `aoFechar`. Como quem usa o modal
   * costuma passar uma função criada no corpo do componente, a identidade dela
   * muda a cada render — e cada tecla digitada dentro do modal disparava a
   * limpeza e a reexecução do efeito, jogando o foco de volta no diálogo. No
   * celular isso fechava o teclado a cada letra.
   */
  useEffect(() => {
    if (!aberto) return
    focoAnterior.current = document.activeElement as HTMLElement | null
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Foco no diálogo para o leitor de tela anunciar o título.
    caixaRef.current?.focus()

    return () => {
      document.body.style.overflow = overflowAnterior
      focoAnterior.current?.focus()
    }
  }, [aberto])

  // O Esc fica num efeito próprio, lendo a callback por referência: assim uma
  // função nova a cada render não reinstala nada nem mexe no foco.
  const fecharRef = useRef(aoFechar)
  fecharRef.current = aoFechar

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') fecharRef.current()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  if (!aberto) return null

  return (
    <Fundo onMouseDown={(ev) => ev.target === ev.currentTarget && aoFechar()}>
      <Caixa role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1} ref={caixaRef}>
        <Cabecalho>
          <h2 id={idTitulo}>{titulo}</h2>
          <BotaoIcone type="button" $variante="fantasma" $redondo onClick={aoFechar} aria-label="Fechar">
            <X size={20} />
          </BotaoIcone>
        </Cabecalho>
        <Corpo>{children}</Corpo>
        {rodape !== undefined && <Rodape>{rodape}</Rodape>}
      </Caixa>
    </Fundo>
  )
}

export interface PropsConfirmacao {
  aberto: boolean
  titulo: string
  descricao: ReactNode
  rotuloConfirmar?: string
  destrutivo?: boolean
  ocupado?: boolean
  /** Quando definido, o botão só libera depois que a pessoa digitar este texto. */
  exigirTexto?: string
  /** Quando definido, o botão só libera depois de marcar esta ciência. */
  exigirCiencia?: string
  aoConfirmar: () => void
  aoCancelar: () => void
}

const LinhaCiencia = styled.label`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[3]};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surfaceAlt};
  font-size: ${({ theme }) => theme.fontSize.small};
  cursor: pointer;

  input {
    width: 20px;
    height: 20px;
    margin: 0;
    flex-shrink: 0;
    accent-color: ${({ theme }) => theme.color.accent};
  }
`

export function Confirmacao({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar = 'Confirmar',
  destrutivo = false,
  ocupado = false,
  exigirTexto,
  exigirCiencia,
  aoConfirmar,
  aoCancelar,
}: PropsConfirmacao) {
  const [texto, setTexto] = useState('')
  const [ciente, setCiente] = useState(false)

  // Reabrir o diálogo nunca deve reaproveitar a confirmação anterior.
  useEffect(() => {
    if (!aberto) {
      setTexto('')
      setCiente(false)
    }
  }, [aberto])

  const liberado =
    !ocupado &&
    (exigirTexto === undefined || texto.trim() === exigirTexto) &&
    (exigirCiencia === undefined || ciente)

  const fechar = useCallback(() => aoCancelar(), [aoCancelar])

  return (
    <Modal
      aberto={aberto}
      titulo={titulo}
      aoFechar={fechar}
      rodape={
        <Acoes $fim>
          <Botao type="button" $variante="contorno" onClick={fechar} disabled={ocupado}>
            Cancelar
          </Botao>
          <Botao
            type="button"
            $variante={destrutivo ? 'perigo' : 'primario'}
            disabled={!liberado}
            onClick={aoConfirmar}
          >
            {ocupado ? 'Aguarde…' : rotuloConfirmar}
          </Botao>
        </Acoes>
      }
    >
      {typeof descricao === 'string' ? <Texto $pequeno>{descricao}</Texto> : descricao}

      {exigirCiencia !== undefined && (
        <LinhaCiencia>
          <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} />
          <span>{exigirCiencia}</span>
        </LinhaCiencia>
      )}

      {exigirTexto !== undefined && (
        <Campo>
          Digite <strong>{exigirTexto}</strong> para confirmar
          <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
        </Campo>
      )}
    </Modal>
  )
}
