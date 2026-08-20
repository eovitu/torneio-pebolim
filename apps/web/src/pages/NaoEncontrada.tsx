/**
 * Rota catch-all. Substitui a tela de erro genérica da hospedagem por uma
 * página nossa, na mesma linguagem visual do restante do app.
 */

import styled from 'styled-components'
import { Navegacao } from '../components/Navegacao'
import { Pagina, Rotulo, Texto } from '../ui/Superficie'
import { Acoes, BotaoLink } from '../ui/Botao'

const Centro = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: ${({ theme }) => theme.space[4]};
  padding: ${({ theme }) => theme.space[10]} 0;
`

const Codigo = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.font.numero};
  font-weight: 800;
  font-size: 96px;
  line-height: 1;
  letter-spacing: -0.05em;
  color: ${({ theme }) => theme.color.campo[100]};
`

export default function NaoEncontrada() {
  return (
    <>
      <Navegacao />
      <Pagina>
        <Centro>
          <Codigo aria-hidden="true">404</Codigo>
          <Rotulo $cor="acento">Bola fora</Rotulo>
          <h1>Página não encontrada</h1>
          <Texto $mudo>O endereço que você abriu não existe ou foi movido.</Texto>
          <Acoes>
            <BotaoLink to="/home" $variante="primario">
              Ir para o início
            </BotaoLink>
            <BotaoLink to="/tournaments" $variante="contorno">
              Ver torneios
            </BotaoLink>
          </Acoes>
        </Centro>
      </Pagina>
    </>
  )
}
