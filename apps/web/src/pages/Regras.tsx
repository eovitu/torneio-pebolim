/**
 * Regras oficiais do campeonato.
 *
 * O conteúdo vem de `RULES` em @pebolim/domain — a mesma fonte que governa o
 * comportamento do sistema. Texto exibido e regra aplicada não têm como
 * divergir, porque são a mesma coisa (§16 do CLAUDE.md).
 */

import styled from 'styled-components'
import { RULES, RULES_VERSION, MATCH_DURATION_SECONDS } from '@pebolim/domain'
import { ScrollText } from 'lucide-react'
import { Navegacao } from '../components/Navegacao'
import { Bloco, Cartao, Pagina, Rotulo, Texto, TituloSecao } from '../ui/Superficie'
import { Badge } from '../ui/Etiqueta'

const Secao = styled(Cartao)`
  h2 {
    font-size: ${({ theme }) => theme.fontSize.h4};
    margin-bottom: ${({ theme }) => theme.space[3]};
  }

  ul {
    margin: 0;
    padding-left: ${({ theme }) => theme.space[5]};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.space[2]};
  }

  li {
    font-size: ${({ theme }) => theme.fontSize.small};
    line-height: ${({ theme }) => theme.lineHeight.normal};
    color: ${({ theme }) => theme.color.textSoft};
  }

  li::marker {
    color: ${({ theme }) => theme.color.accent};
  }
`

const Colunas = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[4]};

  @media (min-width: ${({ theme }) => theme.breakpoint.lg}) {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
`

export default function Regras() {
  return (
    <>
      <Navegacao />
      <Pagina>
        <Bloco>
          <TituloSecao>
            <div>
              <Rotulo $cor="acento">Regulamento</Rotulo>
              <h1>
                <ScrollText size={26} aria-hidden="true" style={{ verticalAlign: '-4px' }} /> Regras
                oficiais
              </h1>
            </div>
            <Badge $tom="marca">versão {RULES_VERSION}</Badge>
          </TituloSecao>
          <Texto $mudo>
            Partida de {MATCH_DURATION_SECONDS} segundos. Estas são as regras que o sistema aplica —
            o placar, a classificação e a artilharia são calculados exatamente por elas.
          </Texto>
        </Bloco>

        <Colunas>
          {RULES.map((secao) => (
            <Secao key={secao.id} as="section">
              <h2>{secao.title}</h2>
              <ul>
                {secao.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Secao>
          ))}
        </Colunas>
      </Pagina>
    </>
  )
}
