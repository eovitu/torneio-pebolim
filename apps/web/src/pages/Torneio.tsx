/**
 * Página completa de um torneio — o detalhamento que a Home não dá (§9).
 *
 * Cabeçalho com estado e ação de inscrição, e o conteúdo em abas: tabela,
 * partidas, equipes, artilharia e participantes. As abas existem para não
 * empilhar cinco seções longas no celular; nenhuma delas esconde informação
 * atrás de mais de um clique.
 *
 * É pública. Quem opera partida e quem pode administrar continua sendo decisão
 * do servidor (§45).
 */

import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import styled from 'styled-components'
import { Check, LogIn, Play, Trophy, Users, WifiOff } from 'lucide-react'
import { MIN_PARTICIPANTES } from '@pebolim/domain'
import { Navegacao } from '../components/Navegacao'
import { CartaoDePartida, CartaoDeTime, LinhaDeJogador, Numero, GradeDeNumeros } from '../components/Cartoes'
import { Artilharia, Classificacao } from '../components/Tabelas'
import { useCampeonato, useMeuJogador } from '../dados/hooks'
import { ROTULO_STATUS_TORNEIO, descreverErro, estaAoVivo } from '../dados/campeonato'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { Bloco, Cartao, Pagina, Painel, Rotulo, Texto, TituloSecao } from '../ui/Superficie'
import { Botao, BotaoLink } from '../ui/Botao'
import { Carregando, Erro, Sucesso, Vazio } from '../ui/Estados'
import { Badge, PontoAoVivo } from '../ui/Etiqueta'
import { midia } from '../design-system/tokens'

const ABAS = [
  { id: 'tabela', rotulo: 'Tabela' },
  { id: 'partidas', rotulo: 'Partidas' },
  { id: 'equipes', rotulo: 'Equipes' },
  { id: 'artilharia', rotulo: 'Artilharia' },
  { id: 'participantes', rotulo: 'Participantes' },
] as const

type Aba = (typeof ABAS)[number]['id']

const BarraAbas = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[1]};
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: ${({ theme }) => theme.space[1]};
  margin: 0 -${({ theme }) => theme.space[4]};
  padding-left: ${({ theme }) => theme.space[4]};
  padding-right: ${({ theme }) => theme.space[4]};
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  ${midia.md} {
    margin: 0;
    padding-left: 0;
    padding-right: 0;
  }
`

const Aba = styled.button<{ $ativa: boolean }>`
  flex-shrink: 0;
  font: inherit;
  font-size: ${({ theme }) => theme.fontSize.small};
  font-weight: 700;
  min-height: 42px;
  padding: 0 ${({ theme }) => theme.space[4]};
  border-radius: ${({ theme }) => theme.radius.pill};
  border: 1px solid
    ${({ theme, $ativa }) => ($ativa ? theme.color.campo[700] : theme.color.borderSoft)};
  background: ${({ theme, $ativa }) => ($ativa ? theme.color.campo[700] : theme.color.surface)};
  color: ${({ theme, $ativa }) => ($ativa ? theme.color.onDark : theme.color.textSoft)};
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.rapido} ease;

  &:hover {
    border-color: ${({ theme }) => theme.color.campo[400]};
  }
`

const TopoPainel = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[4]};
  margin-bottom: ${({ theme }) => theme.space[5]};

  h1 {
    font-size: ${({ theme }) => theme.fontSize.h2};
    overflow-wrap: anywhere;
  }

  ${midia.md} {
    h1 {
      font-size: ${({ theme }) => theme.fontSize.h1};
    }
  }
`

const NumerosPainel = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[6]};

  div {
    display: flex;
    flex-direction: column;
  }

  strong {
    font-family: ${({ theme }) => theme.font.numero};
    font-size: ${({ theme }) => theme.fontSize.h3};
    font-weight: 800;
    line-height: 1.1;
  }

  span {
    font-size: ${({ theme }) => theme.fontSize.micro};
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.onDarkMuted};
  }
`

const Lista = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[3]};

  ${midia.md} {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
`

const ListaJogadores = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[1]};

  ${midia.md} {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
`

export default function Torneio() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const { campeonato, carregando, erro, recarregar, sincronizado } = useCampeonato(id)
  const { jogador, recarregar: recarregarJogador } = useMeuJogador()

  const [aba, setAba] = useState<Aba>('tabela')
  const [ocupado, setOcupado] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const souParticipante = useMemo(
    () =>
      campeonato !== null &&
      jogador !== null &&
      campeonato.participantes.some((p) => p.player_id === jogador.id),
    [campeonato, jogador],
  )

  const executar = async (
    acao: () => PromiseLike<{ error: { message: string } | null }>,
    sucesso: string,
  ) => {
    setErroAcao(null)
    setAviso(null)
    setOcupado(true)
    const { error } = await acao()
    setOcupado(false)
    if (error !== null) {
      setErroAcao(descreverErro(error))
      return
    }
    setAviso(sucesso)
    await Promise.all([recarregar(), recarregarJogador()])
  }

  if (carregando) {
    return (
      <>
        <Navegacao />
        <Pagina>
          <Carregando linhas={4} rotulo="Carregando torneio…" />
        </Pagina>
      </>
    )
  }

  if (erro !== null || campeonato === null) {
    return (
      <>
        <Navegacao />
        <Pagina>
          <Vazio
            icone={<Trophy size={26} />}
            titulo="Torneio não encontrado"
            descricao={erro ?? 'Este campeonato não existe ou não está público.'}
            acao={
              <BotaoLink to="/tournaments" $variante="primario">
                Ver todos os torneios
              </BotaoLink>
            }
          />
        </Pagina>
      </>
    )
  }

  const { torneio, equipes, jogadores, elencos, participantes, partidas, classificacao, artilharia } =
    campeonato

  const jogadorPorId = new Map(jogadores.map((j) => [j.id, j]))
  const inscricoesAbertas = torneio.status === 'CONFIGURACAO'
  /**
   * Quem está inscrito pode começar o torneio, desde que haja duas pessoas.
   * O servidor sorteia as equipes, cria a fase de grupos e gera os confrontos
   * de uma vez — nenhum passo de administrador no caminho.
   */
  const podeComecar =
    souParticipante &&
    participantes.length >= MIN_PARTICIPANTES &&
    (torneio.status === 'CONFIGURACAO' || torneio.status === 'AGUARDANDO_INICIO')
  const aoVivo = partidas.filter((p) => estaAoVivo(p.linha))
  const agendadas = partidas.filter((p) => p.linha.status === 'SCHEDULED')
  const encerradas = partidas.filter((p) => p.linha.status === 'FINISHED')

  return (
    <>
      <Navegacao />
      <Pagina>
        <Painel>
          <TopoPainel>
            <div>
              <Rotulo style={{ color: 'rgba(255,255,255,.65)' }}>Torneio</Rotulo>
              <h1>{torneio.nome}</h1>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Badge $tom="claro">{ROTULO_STATUS_TORNEIO[torneio.status]}</Badge>
                {aoVivo.length > 0 && (
                  <Badge $tom="aoVivo">
                    <PontoAoVivo />
                    {aoVivo.length === 1 ? '1 ao vivo' : `${aoVivo.length} ao vivo`}
                  </Badge>
                )}
                <Badge $tom="claro">regras {torneio.rules_version}</Badge>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
              {souParticipante ? (
                <>
                  <Badge $tom="sucesso" style={{ justifyContent: 'center', padding: '10px' }}>
                    <Check size={14} aria-hidden="true" />
                    Você está inscrito
                  </Badge>
                  {/* Começar o torneio é público, como iniciar uma partida:
                      qualquer inscrito pode, desde que haja duas pessoas.
                      Decisão do proprietário (20/08/2026). O servidor
                      revalida quem é participante (§45). */}
                  {podeComecar && (
                    <Botao
                      type="button"
                      $variante="primario"
                      disabled={ocupado}
                      onClick={() =>
                        void executar(
                          () => supabase.rpc('iniciar_torneio', { p_tournament_id: torneio.id }),
                          'Torneio começou! As partidas já estão valendo.',
                        )
                      }
                    >
                      <Play size={16} aria-hidden="true" />
                      {ocupado ? 'Começando…' : 'Começar torneio'}
                    </Botao>
                  )}
                  {inscricoesAbertas && (
                    <Botao
                      type="button"
                      $variante="claro"
                      $tamanho="sm"
                      disabled={ocupado}
                      onClick={() =>
                        void executar(
                          () => supabase.rpc('sair_do_torneio', { p_tournament_id: torneio.id }),
                          'Você saiu do torneio.',
                        )
                      }
                    >
                      Sair do torneio
                    </Botao>
                  )}
                </>
              ) : inscricoesAbertas ? (
                session === null ? (
                  <BotaoLink to="/login" $variante="primario">
                    <LogIn size={16} aria-hidden="true" />
                    Entrar para participar
                  </BotaoLink>
                ) : (
                  <Botao
                    type="button"
                    $variante="primario"
                    disabled={ocupado}
                    onClick={() =>
                      void executar(
                        () =>
                          supabase.rpc('inscrever_se_no_torneio', { p_tournament_id: torneio.id }),
                        `Você entrou em ${torneio.nome}. Boa sorte!`,
                      )
                    }
                  >
                    {ocupado ? 'Inscrevendo…' : 'Entrar no torneio'}
                  </Botao>
                )
              ) : (
                <Texto $claro $pequeno>
                  As inscrições deste torneio estão encerradas.
                </Texto>
              )}
            </div>
          </TopoPainel>

          <NumerosPainel>
            <div>
              <strong>{participantes.length}</strong>
              <span>Participantes</span>
            </div>
            <div>
              <strong>{equipes.length}</strong>
              <span>Equipes</span>
            </div>
            <div>
              <strong>{partidas.length}</strong>
              <span>Partidas</span>
            </div>
            <div>
              <strong>{encerradas.length}</strong>
              <span>Disputadas</span>
            </div>
          </NumerosPainel>
        </Painel>

        {erroAcao !== null && <Erro>{erroAcao}</Erro>}
        {aviso !== null && <Sucesso>{aviso}</Sucesso>}

        {!sincronizado && (
          <Texto $pequeno $mudo>
            <WifiOff size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Atualização
            automática indisponível no momento.
          </Texto>
        )}

        <BarraAbas role="tablist" aria-label="Seções do torneio">
          {ABAS.map((a) => (
            <Aba
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              $ativa={aba === a.id}
              onClick={() => setAba(a.id)}
            >
              {a.rotulo}
            </Aba>
          ))}
        </BarraAbas>

        {aba === 'tabela' && (
          <Bloco>
            <TituloSecao>
              <h2>Classificação</h2>
            </TituloSecao>
            {classificacao.length === 0 ? (
              <Vazio
                titulo="A tabela ainda não existe"
                descricao="Ela aparece assim que as equipes forem formadas e as primeiras partidas encerrarem."
              />
            ) : (
              <Cartao $compacto>
                <Classificacao linhas={classificacao} />
              </Cartao>
            )}
          </Bloco>
        )}

        {aba === 'partidas' && (
          <>
            {aoVivo.length > 0 && (
              <Bloco>
                <TituloSecao>
                  <h2>Ao vivo</h2>
                </TituloSecao>
                <Lista>
                  {aoVivo.map((p) => (
                    <CartaoDePartida
                      key={p.linha.id}
                      partida={p.linha}
                      nomeA={p.nomeA}
                      nomeB={p.nomeB}
                      placarA={p.placarA}
                      placarB={p.placarB}
                    />
                  ))}
                </Lista>
              </Bloco>
            )}

            <Bloco>
              <TituloSecao>
                <h2>Próximas</h2>
              </TituloSecao>
              {agendadas.length === 0 ? (
                <Vazio titulo="Nenhuma partida agendada" />
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
                    />
                  ))}
                </Lista>
              )}
            </Bloco>

            <Bloco>
              <TituloSecao>
                <h2>Histórico</h2>
              </TituloSecao>
              {encerradas.length === 0 ? (
                <Vazio titulo="Nenhuma partida disputada ainda" />
              ) : (
                <Lista>
                  {encerradas.map((p) => (
                    <CartaoDePartida
                      key={p.linha.id}
                      partida={p.linha}
                      nomeA={p.nomeA}
                      nomeB={p.nomeB}
                      placarA={p.placarA}
                      placarB={p.placarB}
                    />
                  ))}
                </Lista>
              )}
            </Bloco>
          </>
        )}

        {aba === 'equipes' && (
          <Bloco>
            <TituloSecao>
              <h2>Equipes</h2>
            </TituloSecao>
            {equipes.length === 0 ? (
              <Vazio
                icone={<Users size={26} />}
                titulo="As equipes ainda não foram formadas"
                descricao="O organizador sorteia as duplas quando as inscrições fecharem."
              />
            ) : (
              <Lista>
                {equipes.map((e) => {
                  const stats = campeonato.estatisticasDeEquipe.get(e.id)
                  return (
                    <div key={e.id} style={{ display: 'grid', gap: 8 }}>
                      <CartaoDeTime
                        equipe={e}
                        para={`/teams/${e.id}`}
                        integrantes={elencos
                          .filter((l) => l.team_id === e.id)
                          .flatMap((l) => {
                            const j = jogadorPorId.get(l.player_id)
                            return j === undefined ? [] : [j]
                          })}
                      />
                      {stats !== undefined && stats.j > 0 && (
                        <GradeDeNumeros>
                          <Numero valor={stats.pts} rotulo="pts" destaque />
                          <Numero valor={stats.j} rotulo="jogos" />
                          <Numero
                            valor={`${stats.saldo > 0 ? '+' : ''}${stats.saldo}`}
                            rotulo="saldo"
                          />
                        </GradeDeNumeros>
                      )}
                    </div>
                  )
                })}
              </Lista>
            )}
          </Bloco>
        )}

        {aba === 'artilharia' && (
          <Bloco>
            <TituloSecao>
              <h2>Artilharia</h2>
            </TituloSecao>
            <Texto $pequeno $mudo>
              O número em destaque é a artilharia líquida: gol normal vale 1, gol de goleiro vale 2
              e cada gol contra desconta 1. A contagem de bolas aparece ao lado do nome.
            </Texto>
            {artilharia.length === 0 ? (
              <Vazio titulo="Ninguém marcou ainda" />
            ) : (
              <Artilharia linhas={artilharia} jogadores={jogadores} />
            )}
          </Bloco>
        )}

        {aba === 'participantes' && (
          <Bloco>
            <TituloSecao>
              <h2>Participantes</h2>
              <Badge $tom="marca">{participantes.length}</Badge>
            </TituloSecao>
            {participantes.length === 0 ? (
              <Vazio
                icone={<Users size={26} />}
                titulo="Ninguém inscrito ainda"
                descricao={
                  inscricoesAbertas
                    ? 'Seja o primeiro a entrar neste torneio.'
                    : 'Este torneio foi montado sem lista de inscritos.'
                }
              />
            ) : (
              <Cartao $compacto>
                <ListaJogadores>
                  {participantes.flatMap((p) => {
                    const j = jogadorPorId.get(p.player_id)
                    if (j === undefined) return []
                    const equipe = elencos.find((l) => l.player_id === j.id)
                    return [
                      <LinhaDeJogador
                        key={j.id}
                        jogador={j}
                        detalhe={
                          equipe === undefined
                            ? 'sem equipe'
                            : (equipes.find((e) => e.id === equipe.team_id)?.nome ?? undefined)
                        }
                      />,
                    ]
                  })}
                </ListaJogadores>
              </Cartao>
            )}
          </Bloco>
        )}
      </Pagina>
    </>
  )
}
