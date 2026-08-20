/**
 * Condução de um torneio — etapas 2 a 5 do fluxo.
 *
 * Toda passagem de etapa é um clique explícito do administrador. A tela não
 * decide nada sozinha: não gera chaveamento, não promove ninguém, não encerra
 * fase porque "acabaram os jogos". O que ela faz é chamar as funções do banco,
 * que revalidam tudo do lado do servidor.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Enums, Tables } from '../../lib/database.types'
import { Etiqueta, Itens, Linha, Painel, Secao } from '../../components/Admin'
import {
  Alerta,
  Aviso,
  Botao,
  BotaoSecundario,
  Campo,
  Entrada,
  Formulario,
  LinhaAlternativa,
} from '../../components/Formulario'
import { Kicker, Note } from '../../components/Shell'
import { Navegacao } from '../../components/Navegacao'

type Torneio = Tables<'tournaments'>
type Fase = Tables<'phases'>
type Equipe = Tables<'teams'>
type Jogador = Tables<'players'>
type Partida = Tables<'matches'>
type StatusTorneio = Enums<'tournament_status'>

interface Elenco {
  team_id: string
  player_id: string
}

/** Próximo estado do campeonato, na ordem que o banco aceita. */
const PROXIMO_STATUS: Partial<Record<StatusTorneio, StatusTorneio>> = {
  CONFIGURACAO: 'AGUARDANDO_INICIO',
  AGUARDANDO_INICIO: 'EM_ANDAMENTO',
  EM_ANDAMENTO: 'ENCERRADO',
}

const ROTULO_STATUS: Record<StatusTorneio, string> = {
  CONFIGURACAO: 'em configuração',
  AGUARDANDO_INICIO: 'aguardando início',
  EM_ANDAMENTO: 'em andamento',
  ENCERRADO: 'encerrado',
}

export default function Torneio() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [torneio, setTorneio] = useState<Torneio | null>(null)
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [elencos, setElencos] = useState<Elenco[]>([])
  const [fases, setFases] = useState<Fase[]>([])
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [perfis, setPerfis] = useState<Tables<'profiles'>[]>([])

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const [nomeJogador, setNomeJogador] = useState('')
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [nomesEquipes, setNomesEquipes] = useState('')
  const [nomeFase, setNomeFase] = useState('')
  const [tipoFase, setTipoFase] = useState<Enums<'phase_kind'>>('GROUP')
  const [confronto, setConfronto] = useState<Record<string, { a: string; b: string }>>({})
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [textoExclusao, setTextoExclusao] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [t, p, e, tp, f, m, perf] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).maybeSingle(),
      supabase.from('players').select('*').order('nome'),
      supabase.from('teams').select('*').eq('tournament_id', id).order('nome'),
      supabase.from('team_players').select('team_id, player_id').eq('tournament_id', id),
      supabase.from('phases').select('*').eq('tournament_id', id).order('ordem'),
      supabase.from('matches').select('*').eq('tournament_id', id).order('ordem'),
      supabase.from('profiles').select('*').order('nome'),
    ])
    const falha = [t, p, e, tp, f, m, perf].find((r) => r.error)
    if (falha?.error) setErro(falha.error.message)
    setTorneio(t.data ?? null)
    setJogadores(p.data ?? [])
    setEquipes(e.data ?? [])
    setElencos(tp.data ?? [])
    setFases(f.data ?? [])
    setPartidas(m.data ?? [])
    setPerfis(perf.data ?? [])
    setCarregando(false)
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /**
   * Executa uma ação e mostra a mensagem do servidor em caso de recusa.
   *
   * O tipo é `PromiseLike` porque os builders do supabase-js são thenables,
   * não Promises — dá para await, mas não têm `catch`/`finally`.
   */
  const executar = useCallback(
    async (acao: () => PromiseLike<{ error: { message: string } | null }>) => {
      setErro(null)
      setOcupado(true)
      const { error } = await acao()
      if (error) setErro(error.message)
      else await carregar()
      setOcupado(false)
    },
    [carregar],
  )

  const totalExigido = useMemo(
    () => (torneio === null ? 0 : torneio.max_equipes * torneio.jogadores_por_equipe),
    [torneio],
  )

  const nomeDe = useCallback(
    (teamId: string) => equipes.find((e) => e.id === teamId)?.nome ?? '—',
    [equipes],
  )

  if (carregando) return <Painel>Carregando…</Painel>
  if (torneio === null) {
    return (
      <Painel>
        <Note>Torneio não encontrado.</Note>
        <LinhaAlternativa>
          <Link to="/admin/tournaments">Voltar</Link>
        </LinhaAlternativa>
      </Painel>
    )
  }

  const emConfiguracao = torneio.status === 'CONFIGURACAO'
  const proximo = PROXIMO_STATUS[torneio.status]

  return (
    <>
      <Navegacao />
      <Painel>
        <Kicker>Administração</Kicker>
        <h1>{torneio.nome}</h1>
        <Note>
          Campeonato {ROTULO_STATUS[torneio.status]} · {torneio.max_equipes} equipes de{' '}
          {torneio.jogadores_por_equipe} · regras {torneio.rules_version}
        </Note>

        {erro !== null && (
          <Secao>
            <Alerta>{erro}</Alerta>
          </Secao>
        )}

        <Secao>
          <h2>Estado do campeonato</h2>
          <Note>
            Encerrar é sempre possível e preserva tudo — é a saída para um torneio que não vai
            acontecer. Excluir apaga de vez, e só é permitido enquanto não houver nenhuma partida:
            com partida existe histórico, e histórico não se apaga.
          </Note>
          {proximo === undefined ? (
            <Note>O campeonato está encerrado.</Note>
          ) : (
            <Linha>
              <Botao
                type="button"
                disabled={ocupado}
                onClick={() =>
                  void executar(() =>
                    supabase.from('tournaments').update({ status: proximo }).eq('id', torneio.id),
                  )
                }
              >
                Avançar para {ROTULO_STATUS[proximo]}
              </Botao>
              {torneio.status === 'AGUARDANDO_INICIO' && (
                <BotaoSecundario
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    void executar(() =>
                      supabase
                        .from('tournaments')
                        .update({ status: 'CONFIGURACAO' })
                        .eq('id', torneio.id),
                    )
                  }
                >
                  Voltar a configurar
                </BotaoSecundario>
              )}
              {torneio.status !== 'ENCERRADO' && (
                <BotaoSecundario
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    void executar(() =>
                      supabase
                        .from('tournaments')
                        .update({ status: 'ENCERRADO' })
                        .eq('id', torneio.id),
                    )
                  }
                >
                  Encerrar campeonato
                </BotaoSecundario>
              )}
            </Linha>
          )}

          {partidas.length === 0 && (
            <>
              <Etiqueta>Excluir</Etiqueta>
              {confirmandoExclusao ? (
                <Formulario
                  onSubmit={(ev) => {
                    ev.preventDefault()
                    if (textoExclusao.trim() !== torneio.nome) return
                    void executar(async () => {
                      const r = await supabase.rpc('excluir_torneio', {
                        p_tournament_id: torneio.id,
                      })
                      if (!r.error) navigate('/admin/tournaments', { replace: true })
                      return r
                    })
                  }}
                >
                  <Campo>
                    Digite <strong>{torneio.nome}</strong> para confirmar a exclusão
                    <Entrada
                      value={textoExclusao}
                      onChange={(e) => setTextoExclusao(e.target.value)}
                      autoComplete="off"
                    />
                  </Campo>
                  <Linha>
                    <Botao
                      type="submit"
                      disabled={ocupado || textoExclusao.trim() !== torneio.nome}
                    >
                      Excluir definitivamente
                    </Botao>
                    <BotaoSecundario
                      type="button"
                      onClick={() => {
                        setConfirmandoExclusao(false)
                        setTextoExclusao('')
                      }}
                    >
                      Cancelar
                    </BotaoSecundario>
                  </Linha>
                </Formulario>
              ) : (
                <BotaoSecundario type="button" onClick={() => setConfirmandoExclusao(true)}>
                  Excluir este torneio
                </BotaoSecundario>
              )}
            </>
          )}
        </Secao>

        <Secao>
          <h2>Jogadores cadastrados ({jogadores.length})</h2>
          <Note>
            O jogador existe sem conta. Quando ele se cadastrar, o perfil é vinculado e ele passa a
            poder operar partidas.
          </Note>
          <Formulario
            onSubmit={(ev) => {
              ev.preventDefault()
              const nome = nomeJogador.trim()
              if (nome.length < 2) return
              void executar(async () => {
                const r = await supabase.from('players').insert({ nome })
                setNomeJogador('')
                return r
              })
            }}
          >
            <Campo>
              Nome do participante
              <Entrada value={nomeJogador} onChange={(e) => setNomeJogador(e.target.value)} />
            </Campo>
            <Botao type="submit" disabled={ocupado}>
              Cadastrar participante
            </Botao>
          </Formulario>

          {jogadores.length > 0 && (
            <>
              <Etiqueta>Vínculo com conta</Etiqueta>
              <Note>
                Vincular a conta é o que permite à pessoa iniciar e operar partidas. Quem faz o
                vínculo é você — assim ninguém reivindica o nome de outro.
              </Note>
              <Itens>
                {jogadores.map((j) => (
                  <li key={j.id}>
                    <span>{j.nome}</span>
                    <select
                      value={j.profile_id ?? ''}
                      disabled={ocupado}
                      onChange={(ev) =>
                        void executar(() =>
                          supabase.rpc('vincular_jogador_conta', {
                            p_player_id: j.id,
                            p_user_id: ev.target.value === '' ? null : ev.target.value,
                          }),
                        )
                      }
                    >
                      <option value="">sem conta vinculada</option>
                      {perfis.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </Itens>
            </>
          )}
        </Secao>

        <Secao>
          <h2>Equipes ({equipes.length})</h2>
          {equipes.length > 0 ? (
            <Itens>
              {equipes.map((e) => (
                <li key={e.id}>
                  <strong>{e.nome}</strong>
                  <span>
                    {elencos
                      .filter((el) => el.team_id === e.id)
                      .map((el) => jogadores.find((j) => j.id === el.player_id)?.nome ?? '?')
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </Itens>
          ) : !emConfiguracao ? (
            <Note>Nenhuma equipe formada — e o torneio já saiu da configuração.</Note>
          ) : (
            <>
              <Note>
                Selecione {totalExigido} participantes. O sorteio roda no servidor e a semente fica
                registrada na auditoria, para que o resultado possa ser conferido depois.
              </Note>
              <Itens>
                {jogadores.map((j) => (
                  <li key={j.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selecionados.includes(j.id)}
                        onChange={(ev) =>
                          setSelecionados((atual) =>
                            ev.target.checked ? [...atual, j.id] : atual.filter((x) => x !== j.id),
                          )
                        }
                      />{' '}
                      {j.nome}
                    </label>
                  </li>
                ))}
              </Itens>
              <Formulario
                onSubmit={(ev) => {
                  ev.preventDefault()
                  const nomes = nomesEquipes
                    .split(',')
                    .map((n) => n.trim())
                    .filter((n) => n !== '')
                  void executar(() =>
                    supabase.rpc('sortear_equipes', {
                      p_tournament_id: torneio.id,
                      p_player_ids: selecionados,
                      p_nomes_equipes: nomes.length > 0 ? nomes : null,
                      p_seed: null,
                    }),
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
                <Aviso>
                  {selecionados.length} de {totalExigido} selecionados
                </Aviso>
                <Botao type="submit" disabled={ocupado || selecionados.length !== totalExigido}>
                  Sortear equipes
                </Botao>
              </Formulario>
            </>
          )}
        </Secao>

        <Secao>
          <h2>Fases</h2>
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
              })
            }}
          >
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
              <select
                value={tipoFase}
                onChange={(e) => setTipoFase(e.target.value as Enums<'phase_kind'>)}
              >
                <option value="GROUP">Fase de grupos (empate permitido)</option>
                <option value="KNOCKOUT">Mata-mata (empate leva a gol de ouro)</option>
              </select>
            </Campo>
            <Botao type="submit" disabled={ocupado}>
              Criar fase
            </Botao>
          </Formulario>

          {fases.map((f) => {
            const daFase = partidas.filter((p) => p.phase_id === f.id)
            const encerrada = f.encerrada_em !== null
            const escolha = confronto[f.id] ?? { a: '', b: '' }
            return (
              <div key={f.id} style={{ marginTop: 24 }}>
                <Etiqueta>
                  {f.kind === 'GROUP' ? 'Grupos' : 'Mata-mata'} · {daFase.length} jogo(s) ·{' '}
                  {encerrada ? 'encerrada' : 'aberta'}
                </Etiqueta>
                <h3>{f.nome}</h3>

                {f.kind === 'GROUP' && !encerrada && daFase.length === 0 && (
                  <Botao
                    type="button"
                    disabled={ocupado}
                    onClick={() =>
                      void executar(() =>
                        supabase.rpc('gerar_partidas_grupo', { p_phase_id: f.id }),
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
                      void executar(() =>
                        supabase.rpc('criar_partida_mata_mata', {
                          p_phase_id: f.id,
                          p_team_a_id: escolha.a,
                          p_team_b_id: escolha.b,
                          p_agendada_para: null,
                        }),
                      )
                    }}
                  >
                    <Note>
                      Escolha o confronto. O sistema não monta chaveamento sozinho: quem avança é
                      decisão sua.
                    </Note>
                    <Linha>
                      <select
                        value={escolha.a}
                        onChange={(e) =>
                          setConfronto((c) => ({ ...c, [f.id]: { ...escolha, a: e.target.value } }))
                        }
                      >
                        <option value="">Equipe A…</option>
                        {equipes.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nome}
                          </option>
                        ))}
                      </select>
                      <select
                        value={escolha.b}
                        onChange={(e) =>
                          setConfronto((c) => ({ ...c, [f.id]: { ...escolha, b: e.target.value } }))
                        }
                      >
                        <option value="">Equipe B…</option>
                        {equipes.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nome}
                          </option>
                        ))}
                      </select>
                      <Botao type="submit" disabled={ocupado}>
                        Criar confronto
                      </Botao>
                    </Linha>
                  </Formulario>
                )}

                {daFase.length > 0 && (
                  <Itens>
                    {daFase.map((p) => (
                      <li key={p.id}>
                        <Link to={`/matches/${p.id}`}>
                          {p.label} — {nomeDe(p.team_a_id)} × {nomeDe(p.team_b_id)}
                        </Link>
                        <Etiqueta>{p.status}</Etiqueta>
                      </li>
                    ))}
                  </Itens>
                )}

                {!encerrada && daFase.length === 0 && (
                  <BotaoSecundario
                    type="button"
                    disabled={ocupado}
                    onClick={() =>
                      void executar(() => supabase.from('phases').delete().eq('id', f.id))
                    }
                  >
                    Excluir fase
                  </BotaoSecundario>
                )}

                {!encerrada && daFase.length > 0 && (
                  <BotaoSecundario
                    type="button"
                    disabled={ocupado}
                    onClick={() =>
                      void executar(() => supabase.rpc('encerrar_fase', { p_phase_id: f.id }))
                    }
                  >
                    Encerrar {f.nome}
                  </BotaoSecundario>
                )}
              </div>
            )
          })}

          {fases.length === 0 && <Note>Nenhuma fase criada ainda.</Note>}
        </Secao>

        <LinhaAlternativa>
          <Link to="/admin/tournaments">Voltar para a lista</Link>
        </LinhaAlternativa>
      </Painel>
    </>
  )
}
