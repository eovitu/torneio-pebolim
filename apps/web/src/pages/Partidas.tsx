/**
 * Partidas dos torneios em que a pessoa participa.
 *
 * Mostrar só os torneios dela é decisão de interface — ninguém vai operar uma
 * partida de um campeonato aleatório. Quem realmente decide se você pode
 * iniciar e registrar é `is_operador_da_partida` no banco (§45).
 */

import { CalendarDays, WifiOff } from 'lucide-react'
import styled from 'styled-components'
import { Navegacao } from '../components/Navegacao'
import { CartaoDePartida, DestaqueAoVivo } from '../components/Cartoes'
import { useMinhasPartidas } from '../dados/hooks'
import { estaAoVivo } from '../dados/campeonato'
import { useAuth } from '../auth/useAuth'
import { Bloco, Pagina, Rotulo, Texto, TituloSecao } from '../ui/Superficie'
import { BotaoLink } from '../ui/Botao'
import { Carregando, Vazio } from '../ui/Estados'
import { Badge } from '../ui/Etiqueta'
import { midia } from '../design-system/tokens'

const Lista = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[3]};

  ${midia.md} {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
`

export default function Partidas() {
  const { session } = useAuth()
  const { partidas, carregando, sincronizado } = useMinhasPartidas()

  const aoVivo = partidas.filter((p) => estaAoVivo(p.linha))
  const agendadas = partidas.filter((p) => p.linha.status === 'SCHEDULED')
  const encerradas = partidas.filter((p) => p.linha.status === 'FINISHED').reverse()

  return (
    <>
      <Navegacao />
      <Pagina>
        <Bloco>
          <Rotulo $cor="acento">Seus jogos</Rotulo>
          <h1>Partidas</h1>
          <Texto $mudo>
            As partidas dos torneios em que você está. Abra uma partida para acompanhar ao vivo ou,
            se você for o responsável, para operá-la.
          </Texto>
        </Bloco>

        {!sincronizado && !carregando && (
          <Texto $pequeno $mudo>
            <WifiOff size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Atualização
            automática indisponível no momento.
          </Texto>
        )}

        {session === null ? (
          <Vazio
            icone={<CalendarDays size={26} />}
            titulo="Entre para ver suas partidas"
            descricao="Você pode acompanhar qualquer partida pública pela página do torneio, mesmo sem conta."
            acao={
              <BotaoLink to="/tournaments" $variante="primario">
                Ver torneios
              </BotaoLink>
            }
          />
        ) : carregando ? (
          <Carregando linhas={3} rotulo="Carregando suas partidas…" />
        ) : partidas.length === 0 ? (
          <Vazio
            icone={<CalendarDays size={26} />}
            titulo="Nenhuma partida ainda"
            descricao="Você ainda não participa de um torneio com jogos marcados."
            acao={
              <BotaoLink to="/tournaments" $variante="primario">
                Explorar torneios
              </BotaoLink>
            }
          />
        ) : (
          <>
            {aoVivo.length > 0 && (
              <Bloco>
                <TituloSecao>
                  <h2>Ao vivo</h2>
                  <Badge $tom="aoVivo">{aoVivo.length}</Badge>
                </TituloSecao>
                <Lista>
                  {aoVivo.map((p) => (
                    <DestaqueAoVivo
                      key={p.linha.id}
                      partida={p.linha}
                      nomeA={p.nomeA}
                      nomeB={p.nomeB}
                      placarA={p.placarA}
                      placarB={p.placarB}
                      contexto={p.nomeTorneio}
                    />
                  ))}
                </Lista>
              </Bloco>
            )}

            <Bloco>
              <TituloSecao>
                <h2>A jogar</h2>
              </TituloSecao>
              {agendadas.length === 0 ? (
                <Vazio titulo="Nada agendado no momento" />
              ) : (
                <Lista>
                  {agendadas.map((p) => (
                    <CartaoDePartida
                      key={p.linha.id}
                      partida={p.linha}
                      nomeA={p.nomeA}
                      nomeB={p.nomeB}
                      placarA={p.placarA}
                      placarB={p.placarB}
                      contexto={p.nomeTorneio}
                    />
                  ))}
                </Lista>
              )}
            </Bloco>

            {encerradas.length > 0 && (
              <Bloco>
                <TituloSecao>
                  <h2>Já disputadas</h2>
                </TituloSecao>
                <Lista>
                  {encerradas.map((p) => (
                    <CartaoDePartida
                      key={p.linha.id}
                      partida={p.linha}
                      nomeA={p.nomeA}
                      nomeB={p.nomeB}
                      placarA={p.placarA}
                      placarB={p.placarB}
                      contexto={p.nomeTorneio}
                    />
                  ))}
                </Lista>
              </Bloco>
            )}
          </>
        )}
      </Pagina>
    </>
  )
}
