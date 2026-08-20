/**
 * Central do campeonato.
 *
 * A Home responde em segundos a quatro perguntas: quem está jogando agora,
 * quem joga em seguida, quem está ganhando e quem está fazendo gol (§7 do
 * redesign). É um resumo de TODOS os torneios — o detalhamento de um
 * campeonato específico é a página do torneio.
 *
 * É pública: o visitante sem conta vê o mesmo conteúdo, porque é exatamente
 * isso que a RLS libera para ele (§40).
 */

import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { CalendarDays, Flame, ListOrdered, Radio, Trophy, WifiOff } from 'lucide-react'
import { Navegacao } from '../components/Navegacao'
import { CartaoDePartida, DestaqueAoVivo } from '../components/Cartoes'
import { Artilharia, Classificacao } from '../components/Tabelas'
import { usePainel, useCampeonato } from '../dados/hooks'
import { ROTULO_STATUS_TORNEIO } from '../dados/campeonato'
import { useAuth } from '../auth/useAuth'
import { Bloco, Cartao, Grade, Pagina, Rotulo, Texto, TituloSecao } from '../ui/Superficie'
import { Botao, BotaoLink } from '../ui/Botao'
import { Carregando, Erro, Vazio } from '../ui/Estados'
import { Badge } from '../ui/Etiqueta'
import { midia } from '../design-system/tokens'

const Saudacao = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};

  h1 {
    font-size: ${({ theme }) => theme.fontSize.h2};
  }

  ${midia.md} {
    h1 {
      font-size: ${({ theme }) => theme.fontSize.h1};
    }
  }
`

/** No desktop, tabela e artilharia dividem a largura em vez de empilhar. */
const DuasColunas = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[6]};

  ${midia.lg} {
    grid-template-columns: 1.35fr 1fr;
    align-items: start;
  }
`

const AvisoConexao = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[3]} ${({ theme }) => theme.space[4]};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.avisoSuave};
  color: ${({ theme }) => theme.color.aviso};
  font-size: ${({ theme }) => theme.fontSize.small};
  font-weight: 600;
`

const Lista = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[3]};

  ${midia.md} {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
`

export default function Home() {
  const { user } = useAuth()
  const {
    torneios,
    aoVivo,
    proximas,
    recentes,
    emDestaque,
    carregando,
    erro,
    recarregar,
    sincronizado,
  } = usePainel()

  // O torneio em destaque é o único carregado por inteiro: tabela e artilharia
  // exigem todos os eventos dele, e não faz sentido pagar isso por torneio.
  const { campeonato } = useCampeonato(emDestaque?.id ?? null, false)

  return (
    <>
      <Navegacao />
      <Pagina>
        <Saudacao>
          <Rotulo $cor="acento">Central do campeonato</Rotulo>
          <h1>{user !== null ? 'Bem-vindo de volta' : 'Torneio Pebolim'}</h1>
          <Texto $mudo>
            Partidas ao vivo, classificação e artilharia de todos os campeonatos, em tempo real.
          </Texto>
        </Saudacao>

        {erro !== null && <Erro>{erro}</Erro>}

        {/* Nunca fingir tempo real quando o canal caiu (§13 do redesign). */}
        {!sincronizado && !carregando && (
          <AvisoConexao role="status">
            <WifiOff size={17} aria-hidden="true" />
            <span>Sem atualização automática no momento.</span>
            <Botao type="button" $variante="contorno" $tamanho="sm" onClick={() => void recarregar()}>
              Atualizar
            </Botao>
          </AvisoConexao>
        )}

        {carregando ? (
          <Carregando linhas={3} rotulo="Carregando o campeonato…" />
        ) : (
          <>
            <Bloco>
              <TituloSecao>
                <h2>
                  <Radio size={20} aria-hidden="true" />
                  Ao vivo
                </h2>
                {aoVivo.length > 0 && <Badge $tom="aoVivo">{aoVivo.length}</Badge>}
              </TituloSecao>

              {aoVivo.length === 0 ? (
                <Vazio
                  icone={<Radio size={26} />}
                  titulo="Nenhuma partida rolando agora"
                  descricao="Quando alguém iniciar uma partida, o placar aparece aqui na hora."
                  acao={
                    <BotaoLink to="/matches" $variante="contorno">
                      Ver partidas
                    </BotaoLink>
                  }
                />
              ) : (
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
              )}
            </Bloco>

            <Bloco>
              <TituloSecao>
                <h2>
                  <CalendarDays size={20} aria-hidden="true" />
                  Próximas partidas
                </h2>
                <BotaoLink to="/matches" $variante="fantasma" $tamanho="sm">
                  Ver todas
                </BotaoLink>
              </TituloSecao>

              {proximas.length === 0 ? (
                <Vazio
                  icone={<CalendarDays size={26} />}
                  titulo="Nenhuma partida agendada"
                  descricao="As partidas aparecem aqui assim que o organizador montar as fases do torneio."
                />
              ) : (
                <Lista>
                  {proximas.map((p) => (
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

            {emDestaque !== null && (
              <DuasColunas>
                <Bloco>
                  <TituloSecao>
                    <h2>
                      <ListOrdered size={20} aria-hidden="true" />
                      Classificação
                    </h2>
                    <BotaoLink
                      to={`/tournaments/${emDestaque.id}`}
                      $variante="fantasma"
                      $tamanho="sm"
                    >
                      {emDestaque.nome}
                    </BotaoLink>
                  </TituloSecao>

                  <Cartao $compacto>
                    {campeonato === null ? (
                      <Carregando linhas={2} />
                    ) : campeonato.classificacao.length === 0 ? (
                      <Vazio
                        icone={<ListOrdered size={26} />}
                        titulo="A tabela ainda não existe"
                        descricao={`${emDestaque.nome} está ${ROTULO_STATUS_TORNEIO[emDestaque.status].toLowerCase()}. A classificação aparece quando as equipes forem formadas.`}
                        acao={
                          <BotaoLink to={`/tournaments/${emDestaque.id}`} $variante="contorno">
                            Ver torneio
                          </BotaoLink>
                        }
                      />
                    ) : (
                      <Classificacao linhas={campeonato.classificacao} />
                    )}
                  </Cartao>
                </Bloco>

                <Bloco>
                  <TituloSecao>
                    <h2>
                      <Flame size={20} aria-hidden="true" />
                      Artilharia
                    </h2>
                  </TituloSecao>

                  {campeonato === null ? (
                    <Carregando linhas={3} />
                  ) : campeonato.artilharia.length === 0 ? (
                    <Vazio
                      icone={<Flame size={26} />}
                      titulo="Ninguém marcou ainda"
                      descricao="A artilharia é calculada pelos gols das partidas encerradas."
                    />
                  ) : (
                    <Artilharia
                      linhas={campeonato.artilharia}
                      jogadores={campeonato.jogadores}
                      limite={8}
                    />
                  )}
                </Bloco>
              </DuasColunas>
            )}

            {recentes.length > 0 && (
              <Bloco>
                <TituloSecao>
                  <h2>Últimos resultados</h2>
                </TituloSecao>
                <Lista>
                  {recentes.map((p) => (
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

            <Bloco>
              <TituloSecao>
                <h2>
                  <Trophy size={20} aria-hidden="true" />
                  Torneios
                </h2>
                <BotaoLink to="/tournaments" $variante="fantasma" $tamanho="sm">
                  Ver todos
                </BotaoLink>
              </TituloSecao>

              {torneios.length === 0 ? (
                <Vazio
                  icone={<Trophy size={26} />}
                  titulo="Nenhum torneio ainda"
                  descricao="Assim que um campeonato for criado, ele aparece aqui."
                />
              ) : (
                <Grade $min="240px">
                  {torneios.slice(0, 6).map((t) => (
                    <Cartao key={t.id} $compacto>
                      <Rotulo $cor="marca">{ROTULO_STATUS_TORNEIO[t.status]}</Rotulo>
                      <h3 style={{ margin: '6px 0 12px' }}>{t.nome}</h3>
                      <BotaoLink to={`/tournaments/${t.id}`} $variante="contorno" $bloco>
                        Ver torneio
                      </BotaoLink>
                    </Cartao>
                  ))}
                </Grade>
              )}
            </Bloco>

            <Texto $pequeno $mudo>
              <Link to="/rules">Regras oficiais do campeonato</Link>
            </Texto>
          </>
        )}
      </Pagina>
    </>
  )
}
