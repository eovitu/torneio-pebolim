/**
 * Hub da administração.
 *
 * Antes as telas de admin viviam soltas, alcançáveis só por links no rodapé de
 * outras páginas. Esta é a porta única: tudo que é administrativo começa aqui
 * (§14 do redesign).
 */

import styled from 'styled-components'
import { ChevronRight, Shield, Trophy, UserCog } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Navegacao } from '../../components/Navegacao'
import { useTorneios } from '../../dados/hooks'
import { Bloco, Grade, Pagina, Rotulo, Texto, TituloSecao } from '../../ui/Superficie'
import { cartaoInterativo } from '../../ui/estilos'
import { Badge } from '../../ui/Etiqueta'

const Atalho = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[4]};
  padding: ${({ theme }) => theme.space[5]};
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  background: ${({ theme }) => theme.color.surface};
  box-shadow: ${({ theme }) => theme.shadow.xs};
  text-decoration: none;
  color: inherit;
  ${cartaoInterativo}

  h3 {
    font-size: ${({ theme }) => theme.fontSize.h4};
  }
`

const Icone = styled.div`
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.color.campo[50]};
  color: ${({ theme }) => theme.color.campo[600]};
`

export default function PainelAdmin() {
  const { itens } = useTorneios()

  const emAndamento = itens.filter((i) => i.torneio.status === 'EM_ANDAMENTO').length
  const encerrados = itens.filter((i) => i.torneio.status === 'ENCERRADO').length

  return (
    <>
      <Navegacao />
      <Pagina>
        <Bloco>
          <Rotulo $cor="acento">Área restrita</Rotulo>
          <h1>
            <Shield size={26} aria-hidden="true" style={{ verticalAlign: '-4px' }} /> Administração
          </h1>
          <Texto $mudo>
            Tudo o que é administrativo mora aqui: criar e conduzir torneios, gerenciar contas e
            vincular jogadores. Nada disso aparece para quem não é administrador — e o banco
            revalida cada ação do lado do servidor.
          </Texto>
        </Bloco>

        <Grade $min="300px">
          <Atalho to="/admin/tournaments">
            <Icone aria-hidden="true">
              <Trophy size={24} />
            </Icone>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3>Torneios</h3>
              <Texto $pequeno $mudo>
                Criar campeonato, conduzir as fases e consultar o histórico.
              </Texto>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <Badge $tom="marca">{itens.length} no total</Badge>
                {emAndamento > 0 && <Badge $tom="sucesso">{emAndamento} em andamento</Badge>}
                {encerrados > 0 && <Badge $tom="neutro">{encerrados} encerrados</Badge>}
              </div>
            </div>
            <ChevronRight size={20} aria-hidden="true" />
          </Atalho>

          <Atalho to="/admin/users">
            <Icone aria-hidden="true">
              <UserCog size={24} />
            </Icone>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3>Contas</h3>
              <Texto $pequeno $mudo>
                Criar contas para os participantes e conferir quem já tem acesso.
              </Texto>
            </div>
            <ChevronRight size={20} aria-hidden="true" />
          </Atalho>
        </Grade>

        <TituloSecao>
          <Texto $pequeno $mudo>
            O vínculo entre um jogador e uma conta fica dentro de cada torneio, junto da lista de
            participantes.
          </Texto>
        </TituloSecao>
      </Pagina>
    </>
  )
}
