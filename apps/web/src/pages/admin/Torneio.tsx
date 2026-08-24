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
  Hand,
  Layers,
  Plus,
  Settings2,
  Trophy,
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
import {
  Bloco,
  Cartao,
  Divisor,
  Pagina,
  Painel,
  Rotulo,
  Texto,
  TituloSecao,
} from '../../ui/Superficie'
import { Acoes, Botao, BotaoLink } from '../../ui/Botao'
import { Carregando, Erro, Sucesso, Vazio, Aviso } from '../../ui/Estados'
import { Avatar, Badge } from '../../ui/Etiqueta'
import { Confirmacao } from '../../ui/Modal'
import { Campo, CampoMarcacao, Entrada, Formulario, Selecao } from '../../components/Formulario'
import { midia } from '../../design-system/tokens'

type Torneio = Tables<'tournaments'>
type StatusTorneio = Enums<'tournament_status'>

/** Como cada formato de fase se chama na interface. */
const ROTULO_FASE: Record<Enums<'phase_kind'>, string> = {
  GROUP: 'Fase de grupos',
  KNOCKOUT: 'Mata-mata',
  DOUBLE_ELIMINATION: 'Copa (eliminação dupla)',
}

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

/** Escolha entre sortear e montar. Alvo de toque cheio, como manda o §43. */
const AbasDeModo = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.space[2]};
`

const AbaModo = styled.button<{ $ativa: boolean }>`
  font: inherit;
  font-size: ${({ theme }) => theme.fontSize.small};
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[2]};
  min-height: ${({ theme }) => theme.layout.toque};
  padding: 0 ${({ theme }) => theme.space[3]};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.radius.sm};
  transition: background ${({ theme }) => theme.motion.rapido};
  color: ${({ theme, $ativa }) => ($ativa ? theme.color.onDark : theme.color.muted)};
  background: ${({ theme, $ativa }) => ($ativa ? theme.color.campo[700] : theme.color.surfaceAlt)};
  border: 1px solid
    ${({ theme, $ativa }) => ($ativa ? theme.color.campo[700] : theme.color.borderSoft)};
`

const BlocoEquipe = styled.fieldset`
  display: grid;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[3]};
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surfaceAlt};
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
  const [clubes, setClubes] = useState<Tables<'clubs'>[]>([])
  const [membrosDeClube, setMembrosDeClube] = useState<Tables<'club_members'>[]>([])
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
  const [modoFormacao, setModoFormacao] = useState<'sorteio' | 'manual'>('sorteio')
  /** Ordem das equipes no chaveamento da Copa: a posição na lista é a posição na chave. */
  const [ordemDaChave, setOrdemDaChave] = useState<string[]>([])
  /**
   * Uma entrada por equipe a formar. O tamanho é livre — 1 ou 2 jogadores,
   * nunca mais — e quem decide quantas equipes de cada tamanho existem é o
   * administrador, equipe por equipe.
   */
  const [montagem, setMontagem] = useState<{ nome: string; clubId: string; jogadores: string[] }[]>(
    [],
  )

  const carregar = useCallback(async () => {
    const [t, p, e, tp, part, f, m, perf, cl, cm] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).maybeSingle(),
      supabase.from('players').select('*').order('nome'),
      supabase.from('teams').select('*').eq('tournament_id', id).order('nome'),
      supabase.from('team_players').select('*').eq('tournament_id', id),
      supabase.from('tournament_participants').select('*').eq('tournament_id', id),
      supabase.from('phases').select('*').eq('tournament_id', id).order('ordem'),
      supabase.from('matches').select('*').eq('tournament_id', id).order('ordem'),
      supabase.from('profiles').select('*').order('nome'),
      supabase.from('clubs').select('*').order('nome'),
      supabase.from('club_members').select('*'),
    ])
    const falha = [t, p, e, tp, part, f, m, perf, cl, cm].find((r) => r.error)
    if (falha?.error !== undefined && falha.error !== null) setErro(descreverErro(falha.error))
    setTorneio(t.data ?? null)
    setJogadores(p.data ?? [])
    setEquipes(e.data ?? [])
    setElencos(tp.data ?? [])
    setParticipantes(part.data ?? [])
    setFases(f.data ?? [])
    setPartidas(m.data ?? [])
    setPerfis(perf.data ?? [])
    setClubes(cl.data ?? [])
    setMembrosDeClube(cm.data ?? [])
    setCarregando(false)
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // Quem já se inscreveu entra pré-selecionado no sorteio — era isso que fazia
  // o admin marcar oito caixas na mão toda vez.
  useEffect(() => {
    setSelecionados((atual) => (atual.length === 0 ? participantes.map((p) => p.player_id) : atual))
  }, [participantes])

  /**
   * Executa uma ação e mostra a mensagem do servidor em caso de recusa.
   *
   * O tipo é `PromiseLike` porque os builders do supabase-js são thenables,
   * não Promises — dá para await, mas não têm `catch`/`finally`.
   */
  const executar = useCallback(
    async (acao: () => PromiseLike<{ error: { message: string } | null }>, mensagem?: string) => {
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

  /**
   * Slots da montagem manual.
   *
   * O tamanho de cada equipe (1 ou 2) é decisão do administrador — não vem
   * mais da quantidade de inscritos. O servidor revalida que ninguém passa de
   * 2 e que todo mundo acaba em alguma equipe (§8).
   */
  const adicionarEquipe = () => {
    setMontagem((atual) => [...atual, { nome: '', clubId: '', jogadores: [''] }])
  }

  const removerEquipe = (indice: number) => {
    setMontagem((atual) => atual.filter((_, i) => i !== indice))
  }

  const renomearEquipe = (indice: number, nome: string) => {
    setMontagem((atual) => atual.map((s, i) => (i === indice ? { ...s, nome } : s)))
  }

  const alternarDupla = (indice: number, dupla: boolean) => {
    setMontagem((atual) =>
      atual.map((s, i) => {
        if (i !== indice) return s
        const jogadores = dupla ? [...s.jogadores, ''].slice(0, 2) : [s.jogadores[0] ?? '']
        return { ...s, jogadores }
      }),
    )
  }

  // A chave começa na ordem em que as equipes aparecem; o admin reordena.
  useEffect(() => {
    setOrdemDaChave((atual) => {
      const ids = equipes.map((e) => e.id)
      const mesmas = atual.length === ids.length && atual.every((id) => ids.includes(id))
      return mesmas ? atual : ids
    })
  }, [equipes])

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
  /** Histórico é partida DISPUTADA; agendada que nunca rolou não é histórico. */
  const disputadas = partidas.filter((p) => p.status === 'FINISHED').length
  const idsInscritos = new Set(participantes.map((p) => p.player_id))
  const jaCadastrados = jogadores.filter((j) => !idsInscritos.has(j.id))

  /* ---- montagem manual ---------------------------------------------------- */

  const usadosNaMontagem = new Set(montagem.flatMap((s) => s.jogadores).filter((x) => x !== ''))
  const montagemCompleta =
    montagem.length > 0 && montagem.every((s) => s.jogadores.every((j) => j !== ''))

  const membrosDo = (clubId: string) =>
    membrosDeClube.filter((m) => m.club_id === clubId).map((m) => m.player_id)

  /** Escolher um time guardado preenche a dupla dele — é o atalho do pedido. */
  const aplicarClube = (indice: number, clubId: string) => {
    setMontagem((atual) => {
      const proximo = atual.map((s) => ({ ...s, jogadores: [...s.jogadores] }))
      const alvo = proximo[indice]
      if (alvo === undefined) return atual
      alvo.clubId = clubId
      if (clubId === '') return proximo

      // Quem o clube traz precisa estar inscrito e ainda livre nos outros slots.
      const ocupadosFora = new Set(
        proximo.flatMap((s, i) => (i === indice ? [] : s.jogadores)).filter((x) => x !== ''),
      )
      const trazidos = membrosDo(clubId).filter(
        (id) => idsInscritos.has(id) && !ocupadosFora.has(id),
      )
      alvo.jogadores = alvo.jogadores.map((_, i) => trazidos[i] ?? '')
      return proximo
    })
  }

  const escolherJogador = (indice: number, posicao: number, playerId: string) => {
    setMontagem((atual) =>
      atual.map((s, i) => {
        if (i !== indice) {
          // Ninguém em dois lugares: escolher aqui tira a pessoa de onde estava.
          return { ...s, jogadores: s.jogadores.map((j) => (j === playerId ? '' : j)) }
        }
        return { ...s, jogadores: s.jogadores.map((j, k) => (k === posicao ? playerId : j)) }
      }),
    )
  }

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
                        supabase
                          .from('tournaments')
                          .update({ status: proximo })
                          .eq('id', torneio.id),
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
              <strong>{MAX_JOGADORES_POR_EQUIPE} pessoas por equipe</strong>. Não existe número fixo
              a atingir: quem chegar, joga.
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
              {/* Sortear ou montar: a escolha é do administrador. A regra de
                  composição é a mesma nos dois caminhos (§8). */}
              <AbasDeModo role="tablist" aria-label="Como formar as equipes">
                <AbaModo
                  type="button"
                  role="tab"
                  aria-selected={modoFormacao === 'sorteio'}
                  $ativa={modoFormacao === 'sorteio'}
                  onClick={() => setModoFormacao('sorteio')}
                >
                  <Dices size={16} aria-hidden="true" />
                  Sortear
                </AbaModo>
                <AbaModo
                  type="button"
                  role="tab"
                  aria-selected={modoFormacao === 'manual'}
                  $ativa={modoFormacao === 'manual'}
                  onClick={() => setModoFormacao('manual')}
                >
                  <Hand size={16} aria-hidden="true" />
                  Montar à mão
                </AbaModo>
              </AbasDeModo>

              {modoFormacao === 'manual' ? (
                <>
                  <Texto $pequeno $mudo style={{ margin: '16px 0' }}>
                    Monte as equipes uma de cada vez: escolha quem entra — 1 pessoa sozinha ou 2 em
                    dupla, nunca mais — e dê um nome a ela. Com {inscritos.length}{' '}
                    {inscritos.length === 1 ? 'inscrito' : 'inscritos'}, todos precisam acabar em
                    alguma equipe antes de confirmar. Um time guardado preenche a dupla dele de uma
                    vez.
                  </Texto>

                  {inscritos.length < MIN_PARTICIPANTES ? (
                    <Aviso>
                      São necessários ao menos {MIN_PARTICIPANTES} inscritos para existir um
                      confronto.
                    </Aviso>
                  ) : (
                    <Formulario
                      onSubmit={(ev) => {
                        ev.preventDefault()
                        void executar(
                          () =>
                            supabase.rpc('formar_equipes_manual', {
                              p_tournament_id: torneio.id,
                              p_equipes: montagem.map((s) => ({
                                ...(s.nome.trim() === '' ? {} : { nome: s.nome.trim() }),
                                ...(s.clubId === '' ? {} : { club_id: s.clubId }),
                                jogadores: s.jogadores,
                              })),
                            }),
                          'Equipes montadas.',
                        )
                      }}
                    >
                      {montagem.map((slot, indice) => {
                        const dupla = slot.jogadores.length === 2
                        return (
                          <BlocoEquipe key={indice}>
                            <Rotulo>Equipe {indice + 1}</Rotulo>

                            <Campo>
                              Nome da equipe (opcional)
                              <Entrada
                                value={slot.nome}
                                placeholder={`Equipe ${indice + 1}`}
                                disabled={ocupado}
                                onChange={(ev) => renomearEquipe(indice, ev.target.value)}
                              />
                            </Campo>

                            {clubes.length > 0 && (
                              <Campo>
                                Time guardado (opcional)
                                <Selecao
                                  value={slot.clubId}
                                  disabled={ocupado}
                                  onChange={(ev) => aplicarClube(indice, ev.target.value)}
                                >
                                  <option value="">novo time</option>
                                  {clubes.map((c) => (
                                    <option
                                      key={c.id}
                                      value={c.id}
                                      disabled={montagem.some(
                                        (o, i) => i !== indice && o.clubId === c.id,
                                      )}
                                    >
                                      {c.nome}
                                    </option>
                                  ))}
                                </Selecao>
                              </Campo>
                            )}

                            {slot.jogadores.map((escolhido, posicao) => (
                              <Campo key={posicao}>
                                {dupla ? `Jogador ${posicao + 1}` : 'Jogador'}
                                <Selecao
                                  value={escolhido}
                                  disabled={ocupado}
                                  onChange={(ev) => escolherJogador(indice, posicao, ev.target.value)}
                                >
                                  <option value="">escolher…</option>
                                  {inscritos
                                    .filter((j) => j.id === escolhido || !usadosNaMontagem.has(j.id))
                                    .map((j) => (
                                      <option key={j.id} value={j.id}>
                                        {j.nome}
                                      </option>
                                    ))}
                                </Selecao>
                              </Campo>
                            ))}

                            <CampoMarcacao>
                              <input
                                type="checkbox"
                                checked={dupla}
                                disabled={ocupado}
                                onChange={(ev) => alternarDupla(indice, ev.target.checked)}
                              />
                              Dupla (2 jogadores)
                            </CampoMarcacao>

                            <Botao
                              type="button"
                              $variante="fantasma"
                              $tamanho="sm"
                              disabled={ocupado}
                              onClick={() => removerEquipe(indice)}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                              Remover esta equipe
                            </Botao>
                          </BlocoEquipe>
                        )
                      })}

                      <Botao
                        type="button"
                        $variante="contorno"
                        disabled={ocupado}
                        onClick={adicionarEquipe}
                      >
                        <Plus size={16} aria-hidden="true" />
                        Adicionar equipe
                      </Botao>

                      {!montagemCompleta && (
                        <Aviso>Todo mundo precisa estar em alguma equipe antes de confirmar.</Aviso>
                      )}
                      <Botao type="submit" disabled={ocupado || !montagemCompleta} $tamanho="lg">
                        <Hand size={18} aria-hidden="true" />
                        Confirmar equipes
                      </Botao>
                    </Formulario>
                  )}
                </>
              ) : (
                <>
                  <Texto $pequeno $mudo style={{ margin: '16px 0' }}>
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
                              ev.target.checked
                                ? [...atual, j.id]
                                : atual.filter((x) => x !== j.id),
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
                </>
              )}
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
                    <option value="KNOCKOUT">
                      Mata-mata / chaveamento livre — confrontos um a um, sem calendário automático
                    </option>
                    <option value="DOUBLE_ELIMINATION">
                      Copa (eliminação dupla) — só sai com duas derrotas
                    </option>
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
                        {ROTULO_FASE[f.kind]} · {daFase.length} jogo(s)
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

                  {/*
                    Copa: a chave inteira é montada de uma vez e anda sozinha a
                    cada partida encerrada — o vencedor sobe, o perdedor cai
                    para a chave dos perdedores, e quem perde de novo sai. A
                    ordem que o administrador escolhe aqui É o chaveamento; o
                    sistema não inventa critério de semeadura (§67).
                  */}
                  {f.kind === 'DOUBLE_ELIMINATION' && !encerrada && daFase.length === 0 && (
                    <Formulario
                      onSubmit={(ev) => {
                        ev.preventDefault()
                        void executar(
                          () =>
                            supabase.rpc('gerar_eliminacao_dupla', {
                              p_phase_id: f.id,
                              p_team_ids: ordemDaChave.length > 0 ? ordemDaChave : null,
                            }),
                          'Chave gerada. Os confrontos seguintes aparecem sozinhos conforme as partidas terminam.',
                        )
                      }}
                    >
                      <Texto $pequeno $mudo>
                        Perder uma vez não elimina: quem perde na chave dos vencedores cai para a
                        dos perdedores e continua. Sai quem perde duas vezes. Se o campeão dos
                        perdedores vencer a final, joga-se uma segunda final.
                      </Texto>
                      <Texto $pequeno $mudo>
                        A ordem abaixo é o chaveamento — o 1º enfrenta o último, e assim por diante.
                        Com um número que não fecha uma potência de 2, os primeiros passam direto na
                        primeira rodada.
                      </Texto>
                      <ListaSelecao>
                        {ordemDaChave.map((teamId, indice) => (
                          <LinhaLista key={teamId}>
                            <Badge $tom="neutro">{indice + 1}º</Badge>
                            <span>{nomeDe(teamId)}</span>
                            <Botao
                              type="button"
                              $variante="fantasma"
                              $tamanho="sm"
                              disabled={ocupado || indice === 0}
                              aria-label={`Subir ${nomeDe(teamId)}`}
                              onClick={() =>
                                setOrdemDaChave((atual) => {
                                  const proxima = [...atual]
                                  const anterior = proxima[indice - 1]
                                  const este = proxima[indice]
                                  if (anterior === undefined || este === undefined) return atual
                                  proxima[indice - 1] = este
                                  proxima[indice] = anterior
                                  return proxima
                                })
                              }
                            >
                              ↑
                            </Botao>
                          </LinhaLista>
                        ))}
                      </ListaSelecao>
                      <Botao type="submit" disabled={ocupado || equipes.length < 2}>
                        <Trophy size={16} aria-hidden="true" />
                        Gerar a chave
                      </Botao>
                    </Formulario>
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
                        Chaveamento livre: crie a próxima partida quando quiser, escolhendo
                        qualquer confronto — inclusive repetindo uma equipe que já jogou. O sistema
                        não monta calendário nem elimina ninguém automaticamente: quem avança, e
                        quantas vezes cada equipe joga, é decisão sua.
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
                        Criar próxima partida
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
        {/* A zona de risco agora aparece SEMPRE. Antes ela sumia de qualquer
            torneio com partidas — e como começar um torneio já gera todos os
            confrontos de uma vez, isso passou a ser todo torneio, inclusive os
            de teste que nunca rolaram. Histórico é partida DISPUTADA. */}
        <ZonaDeRisco>
          <h2>
            <AlertTriangle size={20} aria-hidden="true" />
            Zona de risco
          </h2>
          <Texto $pequeno style={{ margin: '12px 0 16px' }}>
            Excluir apaga o torneio de vez, com equipes, fases e partidas ainda não disputadas. Só
            deixa de ser possível quando alguma partida já foi jogada: aí existe histórico, e
            histórico não se apaga — nesse caso, encerre o campeonato.
          </Texto>
          {disputadas === 0 ? (
            <Botao type="button" $variante="perigo" onClick={() => setConfirmandoExclusao(true)}>
              <Trash2 size={16} aria-hidden="true" />
              Excluir este torneio
            </Botao>
          ) : (
            <Aviso>
              Este torneio já tem {disputadas} partida(s) disputada(s) — isso é histórico e não se
              apaga. Para tirá-lo do caminho, encerre o campeonato lá em cima.
            </Aviso>
          )}
        </ZonaDeRisco>
      </Pagina>

      <Confirmacao
        aberto={confirmandoExclusao}
        titulo="Excluir torneio definitivamente?"
        descricao="Esta ação não pode ser desfeita. O torneio, as equipes, as fases e as partidas ainda não disputadas serão apagados. Os jogadores continuam existindo, porque podem estar em outros campeonatos."
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
