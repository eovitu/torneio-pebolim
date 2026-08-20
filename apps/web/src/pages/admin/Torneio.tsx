/**
 * Condução de um torneio.
 *
 * Toda passagem de etapa é um clique explícito do administrador. A tela não
 * decide nada sozinha: não gera chaveamento, não promove ninguém, não encerra
 * fase porque "acabaram os jogos". O que ela faz é chamar as funções do banco,
 * que revalidam tudo do lado do servidor.
 *
 * Mudanças do redesign:
 *  - a lista de participantes agora vem de `tournament_participants`, que a
 *    autoinscrição alimenta — o admin não precisa mais digitar nome por nome
 *    (mas ainda pode, para quem não tem conta);
 *  - a capacidade (equipes × jogadores) é editável a qualquer momento, e não
 *    só na criação: se aparecer mais gente, o organizador ajusta;
 *  - excluir torneio saiu do meio do fluxo e virou uma zona de risco separada,
 *    com confirmação por digitação.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'
import {
  AlertTriangle,
  ArrowRight,
  Dices,
  Layers,
  Plus,
  Settings2,
  Trash2,
  Undo2,
  UserPlus,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Enums, Tables } from '../../lib/database.types'
import {
  MAX_JOGADORES_POR_EQUIPE,
  MIN_PARTICIPANTES,
  comporEquipes,
  descreverComposicao,
  temEquipeSozinha,
} from '@pebolim/domain'
import { ROTULO_STATUS_TORNEIO, descreverErro } from '../../dados/campeonato'
import { Navegacao } from '../../components/Navegacao'
import { CartaoDePartida } from '../../components/Cartoes'
import { Bloco, Cartao, Divisor, Pagina, Painel, Rotulo, Texto, TituloSecao } from '../../ui/Superficie'
import { Acoes, Botao, BotaoLink } from '../../ui/Botao'
import { Carregando, Erro, Sucesso, Vazio, Aviso } from '../../ui/Estados'
import { Avatar, Badge } from '../../ui/Etiqueta'
import { Confirmacao } from '../../ui/Modal'
import { Campo, CampoMarcacao, Entrada, Formulario, Selecao } from '../../components/Formulario'
import { midia } from '../../design-system/tokens'

type Torneio = Tables<'tournaments'>
type StatusTorneio = Enums<'tournament_status'>

/** Próximo estado do campeonato, na ordem que o banco aceita. */
const PROXIMO_STATUS: Partial<Record<StatusTorneio, StatusTorneio>> = {
  CONFIGURACAO: 'AGUARDANDO_INICIO',
  AGUARDANDO_INICIO: 'EM_ANDAMENTO',
  EM_ANDAMENTO: 'ENCERRADO',
}

const Grade2 = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[4]};

  ${midia.md} {
    grid-template-columns: 1fr 1fr;
  }
`

const ListaSelecao = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[2]};
  max-height: 340px;
  overflow-y: auto;

  ${midia.md} {
    grid-template-columns: 1fr 1fr;
  }
`

const LinhaLista = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.fontSize.small};

  > span:first-of-type {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const ZonaDeRisco = styled(Cartao)`
  border-color: ${({ theme }) => theme.color.perigo};
  background: ${({ theme }) => theme.color.perigoSuave};

  h2 {
    color: ${({ theme }) => theme.color.perigo};
    font-size: ${({ theme }) => theme.fontSize.h4};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.space[2]};
  }
`

const CartaoFase = styled(Cartao)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};
`

export default function TorneioAdmin() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [torneio, setTorneio] = useState<Torneio | null>(null)
  const [jogadores, setJogadores] = useState<Tables<'players'>[]>([])
  const [equipes, setEquipes] = useState<Tables<'teams'>[]>([])
  const [elencos, setElencos] = useState<Tables<'team_players'>[]>([])
  const [participantes, setParticipantes] = useState<Tables<'tournament_participants'>[]>([])
  const [fases, setFases] = useState<Tables<'phases'>[]>([])
  const [partidas, setPartidas] = useState<Tables<'matches'>[]>([])
  const [perfis, setPerfis] = useState<Tables<'profiles'>[]>([])

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const [nomeJogador, setNomeJogador] = useState('')
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [nomesEquipes, setNomesEquipes] = useState('')
  const [nomeFase, setNomeFase] = useState('')
  const [tipoFase, setTipoFase] = useState<Enums<'phase_kind'>>('GROUP')
  const [confronto, setConfronto] = useState<Record<string, { a: string; b: string }>>({})
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  const carregar = useCallback(async () => {
    const [t, p, e, tp, part, f, m, perf] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).maybeSingle(),
      supabase.from('players').select('*').order('nome'),
      supabase.from('teams').select('*').eq('tournament_id', id).order('nome'),
      supabase.from('team_players').select('*').eq('tournament_id', id),
      supabase.from('tournament_participants').select('*').eq('tournament_id', id),
      supabase.from('phases').select('*').eq('tournament_id', id).order('ordem'),
      supabase.from('matches').select('*').eq('tournament_id', id).order('ordem'),
      supabase.from('profiles').select('*').order('nome'),
    ])
    const falha = [t, p, e, tp, part, f, m, perf].find((r) => r.error)
    if (falha?.error !== undefined && falha.error !== null) setErro(descreverErro(falha.error))
    setTorneio(t.data ?? null)
    setJogadores(p.data ?? [])
    setEquipes(e.data ?? [])
    setElencos(tp.data ?? [])
    setParticipantes(part.data ?? [])
    setFases(f.data ?? [])
    setPartidas(m.data ?? [])
    setPerfis(perf.data ?? [])
    setCarregando(false)
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // Quem já se inscreveu entra pré-selecionado no sorteio — era isso que fazia
  // o admin marcar oito caixas na mão toda vez.
  useEffect(() => {
    setSelecionados((atual) =>
      atual.length === 0 ? participantes.map((p) => p.player_id) : atual,
    )
  }, [participantes])

  /**
   * Executa uma ação e mostra a mensagem do servidor em caso de recusa.
   *
   * O tipo é `PromiseLike` porque os builders do supabase-js são thenables,
   * não Promises — dá para await, mas não têm `catch`/`finally`.
   */
  const executar = useCallback(
    async (
      acao: () => PromiseLike<{ error: { message: string } | null }>,
      mensagem?: string,
    ) => {
      setErro(null)
      setAviso(null)
      setOcupado(true)
      const { error } = await acao()
      if (error !== null) setErro(descreverErro(error))
      else {
        if (mensagem !== undefined) setAviso(mensagem)
        await carregar()
      }
      setOcupado(false)
    },
    [carregar],
  )

  /**
   * Composição derivada do número de inscritos.
   *
   * A mesma função que o banco espelha em `composicao_de_equipes`. A tela só
   * mostra a prévia; quem forma as equipes de fato é o servidor (§45).
   */
  const composicaoAtual = useMemo(() => {
    if (participantes.length < MIN_PARTICIPANTES) return null
    return comporEquipes(participantes.length)
  }, [participantes.length])

  const nomeDe = useCallback(
    (teamId: string) => equipes.find((e) => e.id === teamId)?.nome ?? '—',
    [equipes],
  )

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

  if (torneio === null) {
    return (
      <>
        <Navegacao />
        <Pagina>
          <Vazio
            titulo="Torneio não encontrado"
            acao={
              <BotaoLink to="/admin/tournaments" $variante="primario">
                Voltar para a lista
              </BotaoLink>
            }
          />
        </Pagina>
      </>
    )
  }

  const emConfiguracao = torneio.status === 'CONFIGURACAO'
  const proximo = PROXIMO_STATUS[torneio.status]
  const inscritos = participantes.flatMap((p) => {
    const j = jogadores.find((x) => x.id === p.player_id)
    return j === undefined ? [] : [{ ...j, autoInscrito: p.auto_inscrito }]
  })
  const semEquipe = inscritos.filter((j) => !elencos.some((l) => l.player_id === j.id))
  const idsInscritos = new Set(participantes.map((p) => p.player_id))
  const jaCadastrados = jogadores.filter((j) => !idsInscritos.has(j.id))

  return (
    <>
      <Navegacao />
      <Pagina>
        <Painel>
          <Rotulo style={{ color: 'rgba(255,255,255,.65)' }}>Administração</Rotulo>
          <h1 style={{ marginTop: 4 }}>{torneio.nome}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Badge $tom="claro">{ROTULO_STATUS_TORNEIO[torneio.status]}</Badge>
            <Badge $tom="claro">
              {equipes.length > 0
                ? `${equipes.length} ${equipes.length === 1 ? 'equipe' : 'equipes'}`
                : `máx. ${MAX_JOGADORES_POR_EQUIPE} por equipe`}
            </Badge>
            <Badge $tom="claro">regras {torneio.rules_version}</Badge>
          </div>
          <Acoes style={{ marginTop: 20 }}>
            <BotaoLink to={`/tournaments/${torneio.id}`} $variante="claro" $tamanho="sm">
              Ver página pública
            </BotaoLink>
          </Acoes>
        </Painel>

        {erro !== null && <Erro>{erro}</Erro>}
        {aviso !== null && <Sucesso>{aviso}</Sucesso>}

        {/* ---------------------------------------------------------------- */}
        <Bloco>
          <TituloSecao>
            <h2>Estado do campeonato</h2>
          </TituloSecao>
          <Cartao>
            <Texto $pequeno $mudo style={{ marginBottom: 16 }}>
              Encerrar é sempre possível e preserva tudo — é a saída para um torneio que não vai
              acontecer.
            </Texto>
            {proximo === undefined ? (
              <Aviso>Este campeonato está encerrado. O histórico dele continua disponível.</Aviso>
            ) : (
              <Acoes>
                <Botao
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    void executar(
                      () =>
                        supabase.from('tournaments').update({ status: proximo }).eq('id', torneio.id),
                      `Campeonato agora está ${ROTULO_STATUS_TORNEIO[proximo].toLowerCase()}.`,
                    )
                  }
                >
                  Avançar para {ROTULO_STATUS_TORNEIO[proximo].toLowerCase()}
                  <ArrowRight size={16} aria-hidden="true" />
                </Botao>

                {torneio.status === 'AGUARDANDO_INICIO' && (
                  <Botao
                    type="button"
                    $variante="contorno"
                    disabled={ocupado}
                    onClick={() =>
                      void executar(
                        () =>
                          supabase
                            .from('tournaments')
                            .update({ status: 'CONFIGURACAO' })
                            .eq('id', torneio.id),
                        'Voltou para configuração. As inscrições estão abertas de novo.',
                      )
                    }
                  >
                    Voltar a configurar
                  </Botao>
                )}

                <Botao
                  type="button"
                  $variante="fantasma"
                  disabled={ocupado}
                  onClick={() =>
                    void executar(
                      () =>
                        supabase
                          .from('tournaments')
                          .update({ status: 'ENCERRADO' })
                          .eq('id', torneio.id),
                      'Campeonato encerrado.',
                    )
                  }
                >
                  Encerrar campeonato
                </Botao>
              </Acoes>
            )}
          </Cartao>
        </Bloco>

        {/* ---------------------------------------------------------------- */}
        <Bloco>
          <TituloSecao>
            <h2>
              <Settings2 size={20} aria-hidden="true" />
              Formato
            </h2>
          </TituloSecao>
          <Cartao>
            <Texto>
              As equipes se formam pelo número de inscritos, com no máximo{' '}
              <strong>{MAX_JOGADORES_POR_EQUIPE} pessoas por equipe</strong>. Não existe número
              fixo a atingir: quem chegar, joga.
            </Texto>
            <Texto $pequeno $mudo style={{ marginTop: 12 }}>
              {inscritos.length < MIN_PARTICIPANTES
                ? `Com ${inscritos.length} inscrito(s) ainda não dá para formar confronto — são necessários ao menos ${MIN_PARTICIPANTES}.`
                : `Hoje, com ${inscritos.length} inscrito(s): ${descreverComposicao(comporEquipes(inscritos.length))}.`}
            </Texto>
            {composicaoAtual !== null && temEquipeSozinha(composicaoAtual) && (
              <Texto $pequeno $mudo style={{ marginTop: 8 }}>
                Uma pessoa vai enfrentar duplas sozinha — situação prevista pelas regras.
              </Texto>
            )}
          </Cartao>
        </Bloco>

        {/* ---------------------------------------------------------------- */}
        <Bloco>
          <TituloSecao>
            <h2>
              <UserPlus size={20} aria-hidden="true" />
              Participantes
            </h2>
            <Badge $tom="marca">{inscritos.length}</Badge>
          </TituloSecao>

          <Cartao>
            <Texto $pequeno $mudo style={{ marginBottom: 16 }}>
              As pessoas entram sozinhas pela tela de Torneios enquanto o campeonato está em
              configuração. Cadastre aqui só quem não tem conta.
            </Texto>

            {inscritos.length === 0 ? (
              <Vazio
                titulo="Ninguém inscrito ainda"
                descricao="Compartilhe o link do torneio: as pessoas entram sozinhas."
              />
            ) : (
              <ListaSelecao>
                {inscritos.map((j) => (
                  <LinhaLista key={j.id}>
                    <Avatar nome={j.nome} url={j.foto_url} tamanho="xs" />
                    <span>{j.nome}</span>
                    {j.profile_id === null ? (
                      <Badge $tom="aviso">sem conta</Badge>
                    ) : (
                      <Badge $tom="sucesso">com conta</Badge>
                    )}
                    {emConfiguracao && !elencos.some((l) => l.player_id === j.id) && (
                      <Botao
                        type="button"
                        $variante="fantasma"
                        $tamanho="sm"
                        disabled={ocupado}
                        onClick={() =>
                          void executar(
                            () =>
                              supabase
                                .from('tournament_participants')
                                .delete()
                                .eq('tournament_id', torneio.id)
                                .eq('player_id', j.id),
                            `${j.nome} saiu do torneio.`,
                          )
                        }
                      >
                        Remover
                      </Botao>
                    )}
                  </LinhaLista>
                ))}
              </ListaSelecao>
            )}

            {emConfiguracao && (
              <Formulario
                style={{ marginTop: 20 }}
                onSubmit={(ev) => {
                  ev.preventDefault()
                  const nome = nomeJogador.trim()
                  if (nome.length < 2) return
                  void executar(async () => {
                    const criado = await supabase
                      .from('players')
                      .insert({ nome })
                      .select('id')
                      .maybeSingle()
                    if (criado.error !== null || criado.data === null) return criado
                    // Devolver o resultado da INSCRIÇÃO, e não o da criação do
                    // jogador: antes, uma falha aqui passava calada e a pessoa
                    // aparecia cadastrada mas fora do torneio.
                    const inscrito = await supabase
                      .from('tournament_participants')
                      .insert({ tournament_id: torneio.id, player_id: criado.data.id })
                    setNomeJogador('')
                    return inscrito
                  }, `${nome} foi inscrito.`)
                }}
              >
                <Campo>
                  Inscrever alguém sem conta
                  <Entrada
                    value={nomeJogador}
                    placeholder="Nome do participante"
                    onChange={(e) => setNomeJogador(e.target.value)}
                  />
                </Campo>
                <Botao type="submit" $variante="contorno" disabled={ocupado}>
                  <Plus size={16} aria-hidden="true" />
                  Inscrever participante
                </Botao>
              </Formulario>
            )}

            {emConfiguracao && jaCadastrados.length > 0 && (
              <>
                <Divisor />
                <h3 style={{ marginBottom: 8 }}>Já cadastrados</h3>
                <Texto $pequeno $mudo style={{ marginBottom: 12 }}>
                  Jogadores que existem no sistema mas ainda não estão neste torneio — de outro
                  campeonato, ou de um que foi excluído. Inscreva aqui em vez de cadastrar de novo,
                  para o histórico da pessoa continuar sendo um só.
                </Texto>
                <ListaSelecao>
                  {jaCadastrados.map((j) => (
                    <LinhaLista key={j.id}>
                      <Avatar nome={j.nome} url={j.foto_url} tamanho="xs" />
                      <span>{j.nome}</span>
                      <Botao
                        type="button"
                        $variante="contorno"
                        $tamanho="sm"
                        disabled={ocupado}
                        onClick={() =>
                          void executar(
                            () =>
                              supabase
                                .from('tournament_participants')
                                .insert({ tournament_id: torneio.id, player_id: j.id }),
                            `${j.nome} foi inscrito.`,
                          )
                        }
                      >
                        <Plus size={14} aria-hidden="true" />
                        Inscrever
                      </Botao>
                    </LinhaLista>
                  ))}
                </ListaSelecao>
              </>
            )}
          </Cartao>

          {jogadores.length > 0 && (
            <Cartao>
              <h3 style={{ marginBottom: 8 }}>Vínculo com conta</h3>
              <Texto $pequeno $mudo style={{ marginBottom: 16 }}>
                Vincular a conta é o que permite à pessoa iniciar e operar partidas. Quem faz o
                vínculo é você — assim ninguém reivindica o nome de outro.
              </Texto>
              <ListaSelecao>
                {jogadores.map((j) => (
                  <LinhaLista key={j.id}>
                    <span>{j.nome}</span>
                    <Selecao
                      style={{ maxWidth: 180, minHeight: 40 }}
                      value={j.profile_id ?? ''}
                      disabled={ocupado}
                      onChange={(ev) =>
                        void executar(
                          () =>
                            supabase.rpc('vincular_jogador_conta', {
                              p_player_id: j.id,
                              p_user_id: ev.target.value === '' ? null : ev.target.value,
                            }),
                          'Vínculo atualizado.',
                        )
                      }
                    >
                      <option value="">sem conta</option>
                      {perfis.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </Selecao>
                  </LinhaLista>
                ))}
              </ListaSelecao>
            </Cartao>
          )}
        </Bloco>

        {/* ---------------------------------------------------------------- */}
        <Bloco>
          <TituloSecao>
            <h2>
              <Dices size={20} aria-hidden="true" />
              Equipes
            </h2>
            <Badge $tom="marca">{equipes.length}</Badge>
          </TituloSecao>

          {equipes.length > 0 ? (
            <Cartao>
              <ListaSelecao>
                {equipes.map((e) => (
                  <LinhaLista key={e.id}>
                    <span>
                      <strong>{e.nome}</strong>
                      {' — '}
                      {elencos
                        .filter((el) => el.team_id === e.id)
                        .map((el) => jogadores.find((j) => j.id === el.player_id)?.nome ?? '?')
                        .join(' · ')}
                    </span>
                  </LinhaLista>
                ))}
              </ListaSelecao>
              {semEquipe.length > 0 && (
                <Texto $pequeno $mudo style={{ marginTop: 12 }}>
                  {semEquipe.length} inscrito(s) ainda sem equipe:{' '}
                  {semEquipe.map((j) => j.nome).join(', ')}. Desfaça o sorteio para incluí-los.
                </Texto>
              )}

              {/* Refazer o sorteio virou rotina: chega mais um inscrito e a
                  divisão inteira muda. Só antes de existir partida. */}
              {emConfiguracao && partidas.length === 0 && (
                <Acoes style={{ marginTop: 16 }}>
                  <Botao
                    type="button"
                    $variante="contorno"
                    disabled={ocupado}
                    onClick={() =>
                      void executar(
                        () => supabase.rpc('desfazer_sorteio', { p_tournament_id: torneio.id }),
                        'Sorteio desfeito. As inscrições continuam valendo.',
                      )
                    }
                  >
                    <Undo2 size={16} aria-hidden="true" />
                    Desfazer sorteio
                  </Botao>
                </Acoes>
              )}
            </Cartao>
          ) : !emConfiguracao ? (
            <Aviso>Nenhuma equipe formada — e o torneio já saiu da configuração.</Aviso>
          ) : (
            <Cartao>
              <Texto $pequeno $mudo style={{ marginBottom: 16 }}>
                Escolha quem entra no sorteio — por padrão, todos os inscritos. As equipes se
                formam pelo número de escolhidos. O sorteio roda no servidor e a semente fica
                registrada na auditoria, para que o resultado possa ser conferido depois.
              </Texto>

              <ListaSelecao>
                {inscritos.map((j) => (
                  <CampoMarcacao key={j.id}>
                    <input
                      type="checkbox"
                      checked={selecionados.includes(j.id)}
                      onChange={(ev) =>
                        setSelecionados((atual) =>
                          ev.target.checked ? [...atual, j.id] : atual.filter((x) => x !== j.id),
                        )
                      }
                    />
                    {j.nome}
                  </CampoMarcacao>
                ))}
              </ListaSelecao>

              <Formulario
                style={{ marginTop: 20 }}
                onSubmit={(ev) => {
                  ev.preventDefault()
                  const nomes = nomesEquipes
                    .split(',')
                    .map((n) => n.trim())
                    .filter((n) => n !== '')
                  void executar(
                    () =>
                      supabase.rpc('sortear_equipes', {
                        p_tournament_id: torneio.id,
                        p_player_ids: selecionados,
                        p_nomes_equipes: nomes.length > 0 ? nomes : null,
                        p_seed: null,
                      }),
                    'Equipes sorteadas.',
                  )
                }}
              >
                <Campo>
                  Nomes das equipes, separados por vírgula (opcional)
                  <Entrada
                    value={nomesEquipes}
                    placeholder="Alfa, Bravo, Charlie, Delta"
                    onChange={(e) => setNomesEquipes(e.target.value)}
                  />
                </Campo>
                {selecionados.length < MIN_PARTICIPANTES ? (
                  <Aviso>
                    {selecionados.length} selecionado(s). São necessários ao menos{' '}
                    {MIN_PARTICIPANTES} para existir um confronto.
                  </Aviso>
                ) : (
                  <Aviso>
                    {selecionados.length} selecionados ={' '}
                    {descreverComposicao(comporEquipes(selecionados.length))}.
                  </Aviso>
                )}
                <Botao
                  type="submit"
                  disabled={ocupado || selecionados.length < MIN_PARTICIPANTES}
                  $tamanho="lg"
                >
                  <Dices size={18} aria-hidden="true" />
                  Sortear equipes
                </Botao>
              </Formulario>
            </Cartao>
          )}
        </Bloco>

        {/* ---------------------------------------------------------------- */}
        <Bloco>
          <TituloSecao>
            <h2>
              <Layers size={20} aria-hidden="true" />
              Fases
            </h2>
            <Badge $tom="marca">{fases.length}</Badge>
          </TituloSecao>

          <Cartao>
            <Formulario
              onSubmit={(ev) => {
                ev.preventDefault()
                const nome = nomeFase.trim()
                if (nome === '') return
                const ordem = fases.reduce((maior, f) => Math.max(maior, f.ordem), 0) + 1
                void executar(async () => {
                  const r = await supabase
                    .from('phases')
                    .insert({ tournament_id: torneio.id, kind: tipoFase, nome, ordem })
                  setNomeFase('')
                  return r
                }, `Fase "${nome}" criada.`)
              }}
            >
              <Grade2>
                <Campo>
                  Nome da fase
                  <Entrada
                    value={nomeFase}
                    placeholder="Fase de Grupos"
                    onChange={(e) => setNomeFase(e.target.value)}
                  />
                </Campo>
                <Campo>
                  Tipo
                  <Selecao
                    value={tipoFase}
                    onChange={(e) => setTipoFase(e.target.value as Enums<'phase_kind'>)}
                  >
                    <option value="GROUP">Fase de grupos — empate permitido</option>
                    <option value="KNOCKOUT">Mata-mata — empate leva a gol de ouro</option>
                  </Selecao>
                </Campo>
              </Grade2>
              <Botao type="submit" $variante="contorno" disabled={ocupado}>
                <Plus size={16} aria-hidden="true" />
                Criar fase
              </Botao>
            </Formulario>
          </Cartao>

          {fases.length === 0 ? (
            <Vazio
              icone={<Layers size={26} />}
              titulo="Nenhuma fase criada"
              descricao="Crie ao menos uma fase para gerar partidas. O formato é livre: grupos, mata-mata ou a combinação que você quiser."
            />
          ) : (
            fases.map((f) => {
              const daFase = partidas.filter((p) => p.phase_id === f.id)
              const encerrada = f.encerrada_em !== null
              const escolha = confronto[f.id] ?? { a: '', b: '' }
              return (
                <CartaoFase key={f.id}>
                  <TituloSecao>
                    <div>
                      <Rotulo>
                        {f.kind === 'GROUP' ? 'Fase de grupos' : 'Mata-mata'} · {daFase.length}{' '}
                        jogo(s)
                      </Rotulo>
                      <h3>{f.nome}</h3>
                    </div>
                    <Badge $tom={encerrada ? 'neutro' : 'sucesso'}>
                      {encerrada ? 'encerrada' : 'aberta'}
                    </Badge>
                  </TituloSecao>

                  {f.kind === 'GROUP' && !encerrada && daFase.length === 0 && (
                    <Botao
                      type="button"
                      disabled={ocupado}
                      onClick={() =>
                        void executar(
                          () => supabase.rpc('gerar_partidas_grupo', { p_phase_id: f.id }),
                          'Partidas geradas.',
                        )
                      }
                    >
                      Gerar todos contra todos
                    </Botao>
                  )}

                  {f.kind === 'KNOCKOUT' && !encerrada && (
                    <Formulario
                      onSubmit={(ev) => {
                        ev.preventDefault()
                        if (escolha.a === '' || escolha.b === '') return
                        void executar(
                          () =>
                            supabase.rpc('criar_partida_mata_mata', {
                              p_phase_id: f.id,
                              p_team_a_id: escolha.a,
                              p_team_b_id: escolha.b,
                              p_agendada_para: null,
                            }),
                          'Confronto criado.',
                        )
                      }}
                    >
                      <Texto $pequeno $mudo>
                        Escolha o confronto. O sistema não monta chaveamento sozinho: quem avança é
                        decisão sua.
                      </Texto>
                      <Grade2>
                        <Selecao
                          value={escolha.a}
                          onChange={(e) =>
                            setConfronto((c) => ({
                              ...c,
                              [f.id]: { ...escolha, a: e.target.value },
                            }))
                          }
                        >
                          <option value="">Equipe A…</option>
                          {equipes.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nome}
                            </option>
                          ))}
                        </Selecao>
                        <Selecao
                          value={escolha.b}
                          onChange={(e) =>
                            setConfronto((c) => ({
                              ...c,
                              [f.id]: { ...escolha, b: e.target.value },
                            }))
                          }
                        >
                          <option value="">Equipe B…</option>
                          {equipes.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nome}
                            </option>
                          ))}
                        </Selecao>
                      </Grade2>
                      <Botao type="submit" $variante="contorno" disabled={ocupado}>
                        Criar confronto
                      </Botao>
                    </Formulario>
                  )}

                  {daFase.length > 0 && (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {daFase.map((p) => (
                        <CartaoDePartida
                          key={p.id}
                          partida={p}
                          nomeA={nomeDe(p.team_a_id)}
                          nomeB={nomeDe(p.team_b_id)}
                          placarA={0}
                          placarB={0}
                        />
                      ))}
                    </div>
                  )}

                  <Acoes>
                    {!encerrada && daFase.length === 0 && (
                      <Botao
                        type="button"
                        $variante="fantasma"
                        disabled={ocupado}
                        onClick={() =>
                          void executar(
                            () => supabase.from('phases').delete().eq('id', f.id),
                            'Fase excluída.',
                          )
                        }
                      >
                        Excluir fase
                      </Botao>
                    )}
                    {!encerrada && daFase.length > 0 && (
                      <Botao
                        type="button"
                        $variante="contorno"
                        disabled={ocupado}
                        onClick={() =>
                          void executar(
                            () => supabase.rpc('encerrar_fase', { p_phase_id: f.id }),
                            `${f.nome} encerrada.`,
                          )
                        }
                      >
                        Encerrar {f.nome}
                      </Botao>
                    )}
                  </Acoes>
                </CartaoFase>
              )
            })
          )}
        </Bloco>

        {/* ---------------------------------------------------------------- */}
        {partidas.length === 0 && (
          <ZonaDeRisco>
            <h2>
              <AlertTriangle size={20} aria-hidden="true" />
              Zona de risco
            </h2>
            <Texto $pequeno style={{ margin: '12px 0 16px' }}>
              Excluir apaga o torneio de vez, com equipes e fases. Só é possível enquanto não houver
              nenhuma partida: com partida existe histórico, e histórico não se apaga. Para tirar do
              caminho um torneio que já tem jogos, encerre-o.
            </Texto>
            <Botao type="button" $variante="perigo" onClick={() => setConfirmandoExclusao(true)}>
              <Trash2 size={16} aria-hidden="true" />
              Excluir este torneio
            </Botao>
          </ZonaDeRisco>
        )}
      </Pagina>

      <Confirmacao
        aberto={confirmandoExclusao}
        titulo="Excluir torneio definitivamente?"
        descricao="Esta ação não pode ser desfeita. O torneio, as equipes e as fases serão apagados. Os jogadores continuam existindo, porque podem estar em outros campeonatos."
        exigirTexto={torneio.nome}
        rotuloConfirmar="Excluir definitivamente"
        destrutivo
        ocupado={ocupado}
        aoCancelar={() => setConfirmandoExclusao(false)}
        aoConfirmar={() => {
          setConfirmandoExclusao(false)
          void executar(async () => {
            const r = await supabase.rpc('excluir_torneio', { p_tournament_id: torneio.id })
            if (r.error === null) navigate('/admin/tournaments', { replace: true })
            return r
          })
        }}
      />
    </>
  )
}
