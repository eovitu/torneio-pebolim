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
  z-index: 10;
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
  overflow-y: auto;
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
  onCancelar: () => void
  /** Recebe a versão efetivamente lida, que é a gravada no aceite. */
  onAceitar: (versao: string) => void
}

export function ModalRegras({ onCancelar, onAceitar }: Props) {
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
  }, [verificarRolagem])

  useEffect(() => {
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

        <Corpo ref={corpoRef} onScroll={verificarRolagem} tabIndex={0}>
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
          {!leuTudo && <Dica>Role até o fim para poder aceitar.</Dica>}
          <Acoes>
            <BotaoSecundario type="button" onClick={onCancelar}>
              Cancelar
            </BotaoSecundario>
            <Botao type="button" disabled={!leuTudo} onClick={() => onAceitar(RULES_VERSION)}>
              Li e aceito
            </Botao>
          </Acoes>
        </Rodape>
      </Caixa>
    </Fundo>
  )
}
