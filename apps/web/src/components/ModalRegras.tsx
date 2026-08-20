/**
 * Modal de leitura das regras oficiais, exigido no cadastro (§17).
 *
 * O botão de confirmar só é liberado depois que a pessoa rola até o fim do
 * texto. O conteúdo vem de `RULES` em @pebolim/domain — a mesma fonte que
 * governa o comportamento do sistema —, então texto exibido e regra aplicada
 * não têm como divergir.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { RULES, RULES_VERSION } from '@pebolim/domain'
import { Botao, BotaoSecundario } from './Formulario'

const Fundo = styled.div`
  position: fixed;
  inset: 0;
  /* Acima da barra de navegacao, que e sticky. Com o valor antigo (10, abaixo
     dos 20 da barra) o topo do modal ficava coberto pelo cabecalho. */
  z-index: ${({ theme }) => theme.zIndex.modal};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.space[4]};
  background: color-mix(in srgb, #201e1d 55%, transparent);
`

const Caixa = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: ${({ theme }) => theme.layout.appMaxWidth};
  max-height: 90dvh;
  border: 2px solid ${({ theme }) => theme.color.text};
  background: ${({ theme }) => theme.color.neutral[100]};
`

const Cabecalho = styled.header`
  flex-shrink: 0;
  padding: ${({ theme }) => theme.space[4]};
  border-bottom: 2px solid ${({ theme }) => theme.color.divider};

  h2 {
    margin: 0;
    font-size: 18px;
  }

  p {
    margin: ${({ theme }) => theme.space[1]} 0 0;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.muted};
  }
`

const Corpo = styled.div`
  /* "min-height: 0" e o que permite este item ENCOLHER dentro do flex. Sem
     ele o padrao "min-height: auto" impede o encolhimento: a caixa estoura os
     90dvh, o rodape com o botao sai da tela e nada rola — era impossivel ler
     ate o fim e aceitar. */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: ${({ theme }) => theme.space[4]};
  -webkit-overflow-scrolling: touch;

  section + section {
    margin-top: ${({ theme }) => theme.space[6]};
  }

  h3 {
    margin: 0 0 ${({ theme }) => theme.space[2]};
    font-size: 14px;
  }

  ul {
    margin: 0;
    padding-left: ${({ theme }) => theme.space[4]};
  }

  li {
    font-size: 14px;
    line-height: 1.5;
  }

  li + li {
    margin-top: ${({ theme }) => theme.space[2]};
  }
`

const Rodape = styled.footer`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[4]};
  border-top: 2px solid ${({ theme }) => theme.color.divider};
`

const Dica = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.color.muted};
`

const Acoes = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[3]};

  button {
    flex: 1;
  }
`

interface Props {
  /**
   * Quando ausente, o modal é OBRIGATÓRIO: não há botão de cancelar e o Esc
   * não fecha. É assim que ele aparece na entrada do app — a pessoa precisa
   * ler e confirmar antes de usar qualquer tela.
   */
  onCancelar?: () => void
  /** Recebe a versão efetivamente lida, que é a gravada no aceite. */
  onAceitar: (versao: string) => void
  /** Texto de apoio acima dos botões. */
  aviso?: string
}

export function ModalRegras({ onCancelar, onAceitar, aviso }: Props) {
  const corpoRef = useRef<HTMLDivElement>(null)
  const [leuTudo, setLeuTudo] = useState(false)

  const verificarRolagem = useCallback(() => {
    const el = corpoRef.current
    if (el === null) return
    // Margem de 8px: arredondamento de zoom/DPI pode impedir o valor exato.
    const chegouAoFim = el.scrollTop + el.clientHeight >= el.scrollHeight - 8
    if (chegouAoFim) setLeuTudo(true)
  }, [])

  useEffect(() => {
    // Se o texto couber inteiro na tela, não existe rolagem a fazer — nesse
    // caso o conteúdo já está todo visível e o botão pode liberar.
    verificarRolagem()

    // Uma medição só, na montagem, não basta: fonte que carrega depois, teclado
    // que abre e rotação de tela mudam a altura. Sem remedir, a pessoa pode
    // ficar presa com o botão travado mesmo tendo lido tudo.
    const el = corpoRef.current
    if (el === null) return
    const observador = new ResizeObserver(() => verificarRolagem())
    observador.observe(el)
    return () => observador.disconnect()
  }, [verificarRolagem])

  // Trava a rolagem do fundo enquanto o modal está aberto — senão o dedo rola a
  // página atrás em vez do texto das regras.
  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [])

  useEffect(() => {
    if (onCancelar === undefined) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [onCancelar])

  return (
    <Fundo role="dialog" aria-modal="true" aria-labelledby="titulo-regras">
      <Caixa>
        <Cabecalho>
          <h2 id="titulo-regras">Regras oficiais</h2>
          <p>Versão {RULES_VERSION}</p>
        </Cabecalho>

        <Corpo ref={corpoRef} onScroll={verificarRolagem} tabIndex={0} data-testid="regras-corpo">
          {RULES.map((secao) => (
            <section key={secao.id}>
              <h3>{secao.title}</h3>
              <ul>
                {secao.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </Corpo>

        <Rodape>
          {aviso !== undefined && <Dica>{aviso}</Dica>}
          {!leuTudo && <Dica>Role até o fim para poder aceitar.</Dica>}
          <Acoes>
            {onCancelar !== undefined && (
              <BotaoSecundario type="button" onClick={onCancelar}>
                Cancelar
              </BotaoSecundario>
            )}
            <Botao type="button" disabled={!leuTudo} onClick={() => onAceitar(RULES_VERSION)}>
              Li e aceito
            </Botao>
          </Acoes>
        </Rodape>
      </Caixa>
    </Fundo>
  )
}
