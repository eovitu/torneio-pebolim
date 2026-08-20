/**
 * Operação da partida ao vivo — a tela mais importante do produto.
 *
 * Prioridades (§41): botões grandes, retorno imediato, estado do jogo legível
 * a um metro de distância. O placar exibido é o valor PONDERADO; a quantidade
 * física de gols aparece separada logo abaixo, para que 21 no placar nunca
 * seja confundido com 21 gols (§31).
 *
 * A tela é pública: o espectador sem conta acompanha tudo em tempo real e não
 * vê botão nenhum (§40). Esconder o botão é conveniência — quem barra de fato
 * é a RLS e as funções do banco (§45).
 *
 * Iniciar exige confirmação explícita: uma partida iniciada por engano fica
 * visível para todo mundo e o relógio já correu.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import styled, { css } from 'styled-components'
import {
  MATCH_DURATION_MS,
  canRegisterGoal,
  displayMs,
  formatClock,
  isRegulationOver,
} from '@pebolim/domain'
import type { GoalEventType } from '@pebolim/domain'
import { Minus, Pause, Play, Square, Target, WifiOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { useAuth } from '../auth/useAuth'
import { usePapeis } from '../auth/usePapeis'
import { usePartida } from '../partida/usePartida'
import { paraRelogioDoDominio } from '../partida/adaptadores'
import { useRelogioServidor } from '../partida/useRelogioServidor'
import { descreverErro } from '../dados/campeonato'
import { Navegacao } from '../components/Navegacao'
import { Bloco, Cartao, Pagina, Rotulo, Texto, TituloSecao } from '../ui/Superficie'
import { Acoes, Botao } from '../ui/Botao'
import { Carregando, Erro, Vazio } from '../ui/Estados'
import { Avatar, Badge, PontoAoVivo } from '../ui/Etiqueta'
import { Confirmacao, Modal } from '../ui/Modal'
import { midia } from '../design-system/tokens'

const ROTULO_EVENTO: Record<string, string> = {
  NORMAL_GOAL: 'Gol',
  KEEPER_GOAL: 'Gol de goleiro (vale 2)',
  OWN_GOAL: 'Gol contra (vale 1)',
  GOAL_REMOVED: 'Gol removido',
  MATCH_STARTED: 'Início da partida',
  MATCH_PAUSED: 'Pausa',
  MATCH_RESUMED: 'Retomada',
  GOLDEN_GOAL_STARTED: 'Gol de ouro',
  MATCH_FINISHED: 'Fim da partida',
}

/* -------------------------------------------------------------------------- */
/* Placar                                                                     */
/* -------------------------------------------------------------------------- */

const Placar = styled.section<{ $ouro: boolean }>`
  position: relative;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: ${({ theme }) => theme.space[5]};
  color: ${({ theme }) => theme.color.onDark};
  background: ${({ theme, $ouro }) =>
    $ouro
      ? `linear-gradient(140deg, #6b4a05 0%, #a8770a 55%, ${theme.color.ouro} 100%)`
      : `linear-gradient(140deg, ${theme.color.campo[900]} 0%, ${theme.color.campo[700]} 60%, ${theme.color.campo[600]} 100%)`};
  box-shadow: ${({ theme }) => theme.shadow.md};

  /* Linha de meio-campo. */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    background: rgba(255, 255, 255, 0.14);
  }

  > * {
    position: relative;
    z-index: 1;
  }
`

const TopoPlacar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
  margin-bottom: ${({ theme }) => theme.space[5]};
`

const Corpo = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  text-align: center;
`

const NomeLado = styled.h2`
  font-size: ${({ theme }) => theme.fontSize.small};
  margin: 0 0 ${({ theme }) => theme.space[3]};
  overflow-wrap: anywhere;

  ${midia.md} {
    font-size: ${({ theme }) => theme.fontSize.h4};
  }
`

const Gol = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.font.numero};
  font-weight: 800;
  font-size: ${({ theme }) => theme.fontSize.placar};
  font-variant-numeric: tabular-nums;
  line-height: 1;
`

const Detalhe = styled.p`
  margin: ${({ theme }) => theme.space[2]} 0 0;
  font-size: ${({ theme }) => theme.fontSize.micro};
  line-height: 1.5;
  color: ${({ theme }) => theme.color.onDarkMuted};
`

const pulsar = css`
  animation: pb-pulsar 1.6s ease-in-out infinite;
`

const Cronometro = styled.div<{ $alerta: boolean; $pulsando: boolean }>`
  margin-top: ${({ theme }) => theme.space[5]};
  text-align: center;
  padding: ${({ theme }) => theme.space[3]};
  border-radius: ${({ theme }) => theme.radius.md};
  background: rgba(0, 0, 0, 0.22);
  border: 2px solid
    ${({ $alerta }) => ($alerta ? 'rgba(255,255,255,.85)' : 'rgba(255, 255, 255, 0.14)')};

  p {
    margin: 0;
    font-family: ${({ theme }) => theme.font.numero};
    font-weight: 800;
    font-size: ${({ theme }) => theme.fontSize.display};
    font-variant-numeric: tabular-nums;
    line-height: 1;
    ${({ $pulsando }) => $pulsando && pulsar}
  }
`

/* -------------------------------------------------------------------------- */
/* Painel de gols                                                             */
/* -------------------------------------------------------------------------- */

const Times = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.space[3]};
`

const PainelTime = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[3]};
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.color.surface};

  h3 {
    font-size: ${({ theme }) => theme.fontSize.small};
    text-align: center;
    overflow-wrap: anywhere;
  }
`

const BlocoJogador = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surfaceAlt};
`

const NomeJogador = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.fontSize.caption};
  font-weight: 700;
  min-width: 0;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const ParDeBotoes = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.space[2]};
`

/** Alvo grande e rotulado: nada de ícone solto no meio da partida (§41). */
const BotaoGol = styled.button<{ $goleiro?: boolean }>`
  font: inherit;
  font-size: ${({ theme }) => theme.fontSize.micro};
  font-weight: 800;
  letter-spacing: 0.04em;
  min-height: 52px;
  padding: 0 ${({ theme }) => theme.space[1]};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;
  color: ${({ theme, $goleiro }) => ($goleiro === true ? '#fff' : theme.color.campo[800])};
  background: ${({ theme, $goleiro }) =>
    $goleiro === true ? theme.color.bola[500] : theme.color.campo[100]};
  border: 2px solid
    ${({ theme, $goleiro }) => ($goleiro === true ? theme.color.bola[500] : theme.color.campo[200])};
  transition: transform ${({ theme }) => theme.motion.rapido} ease;

  &:active:not(:disabled) {
    transform: scale(0.94);
  }

  &:disabled {
    opacity: 0.38;
    cursor: not-allowed;
  }
`

const BotaoAuxiliar = styled(BotaoGol)`
  min-height: 44px;
  background: ${({ theme }) => theme.color.surface};
  border-color: ${({ theme }) => theme.color.border};
  color: ${({ theme }) => theme.color.textSoft};
`

const ResumoTime = styled.p`
  margin: 0;
  text-align: center;
  font-size: ${({ theme }) => theme.fontSize.micro};
  color: ${({ theme }) => theme.color.muted};
`

/* -------------------------------------------------------------------------- */
/* Feed                                                                       */
/* -------------------------------------------------------------------------- */

const Feed = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space[3]};
    font-size: ${({ theme }) => theme.fontSize.small};
    padding: ${({ theme }) => theme.space[3]} 0;
    border-bottom: 1px solid ${({ theme }) => theme.color.borderSoft};
    animation: pb-surgir ${({ theme }) => theme.motion.normal}
      ${({ theme }) => theme.motion.entrada} both;
  }

  li:last-child {
    border-bottom: 0;
  }
`

const Riscado = styled.span`
  text-decoration: line-through;
  color: ${({ theme }) => theme.color.muted};
`

const Relogio = styled.span`
  font-family: ${({ theme }) => theme.font.numero};
  font-variant-numeric: tabular-nums;
  font-size: ${({ theme }) => theme.fontSize.caption};
  color: ${({ theme }) => theme.color.muted};
`

const AvisoConexao = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[3]} ${({ theme }) => theme.space[4]};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.avisoSuave};
  color: ${({ theme }) => theme.color.aviso};
  font-size: ${({ theme }) => theme.fontSize.small};
  font-weight: 600;
`

export default function Partida() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { ehAdmin } = usePapeis()
  const { dados, carregando, erro, recarregar, sincronizado } = usePartida(id)
  const { agora, pronto: relogioPronto } = useRelogioServidor()

  const [, redesenhar] = useState(0)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [escolhendoContra, setEscolhendoContra] = useState<string | null>(null)
  const [confirmandoInicio, setConfirmandoInicio] = useState(false)
  const [confirmandoFim, setConfirmandoFim] = useState(false)

  // Apenas para redesenhar o cronômetro. NÃO é a fonte do tempo (§19).
  useEffect(() => {
    const t = setInterval(() => redesenhar((n) => n + 1), 250)
    return () => clearInterval(t)
  }, [])

  const executar = useCallback(
    async (acao: () => PromiseLike<{ error: { message: string } | null }>) => {
      setErroAcao(null)
      setOcupado(true)
      const { error } = await acao()
      if (error !== null) setErroAcao(descreverErro(error))
      else await recarregar()
      setOcupado(false)
    },
    [recarregar],
  )

  if (carregando) {
    return (
      <>
        <Navegacao />
        <Pagina $estreita>
          <Carregando linhas={3} rotulo="Carregando partida…" />
        </Pagina>
      </>
    )
  }

  if (erro !== null || dados === null) {
    return (
      <>
        <Navegacao />
        <Pagina $estreita>
          <Vazio
            icone={<Target size={26} />}
            titulo="Partida não encontrada"
            descricao={erro ?? 'Esta partida não existe ou não está pública.'}
          />
        </Pagina>
      </>
    )
  }

  const { partida, equipeA, equipeB, escalacao, placar, linhasDeEvento } = dados
  const relogio = paraRelogioDoDominio(partida)
  const instante = agora()
  const emOuro = partida.status === 'GOLDEN_GOAL'
  const tempoEsgotado = partida.status === 'LIVE' && isRegulationOver(relogio, instante)
  const tempo = formatClock(displayMs(relogio, partida.status, instante))
  const acabando =
    partida.status === 'LIVE' && !tempoEsgotado && displayMs(relogio, partida.status, instante) <= 15000

  // Espelha is_operador_da_partida do banco. A decisão real é do servidor.
  const souEscalado = escalacao.some((l) => l.jogador.profile_id === user?.id)
  const souArbitro = partida.arbitro_user_id === user?.id
  const podeOperar = user !== null && (ehAdmin || souArbitro || souEscalado)
  const podeIniciar = user !== null && partida.status === 'SCHEDULED'
  const emAndamento =
    partida.status === 'LIVE' || partida.status === 'PAUSED' || partida.status === 'GOLDEN_GOAL'

  const golLiberado =
    podeOperar && canRegisterGoal(partida.status) && !tempoEsgotado && !ocupado && relogioPronto

  const registrar = (tipo: GoalEventType, teamId: string, playerId: string) =>
    void executar(() =>
      supabase.rpc('registrar_gol', {
        p_match_id: partida.id,
        p_type: tipo,
        p_team_id: teamId,
        p_player_id: playerId,
      }),
    )

  const desfazerUltimo = (teamId: string) => {
    const removidos = new Set(
      linhasDeEvento.filter((e) => e.type === 'GOAL_REMOVED').map((e) => e.removed_event_id),
    )
    const ultimo = [...linhasDeEvento]
      .reverse()
      .find(
        (e) =>
          e.team_id === teamId &&
          ['NORMAL_GOAL', 'KEEPER_GOAL', 'OWN_GOAL'].includes(e.type) &&
          !removidos.has(e.id),
      )
    if (ultimo === undefined) {
      setErroAcao('Esta equipe não tem gol para desfazer.')
      return
    }
    void executar(() =>
      supabase.rpc('remover_gol', {
        p_match_id: partida.id,
        p_event_id: ultimo.id,
        p_motivo: 'Desfeito durante a partida',
      }),
    )
  }

  const painel = (equipe: Tables<'teams'>, lado: 'A' | 'B') => {
    const linha = lado === 'A' ? placar.teamA : placar.teamB
    const jogadores = escalacao.filter((l) => l.team_id === equipe.id)

    return (
      <PainelTime>
        <h3>{equipe.nome}</h3>

        {jogadores.map((l) => (
          <BlocoJogador key={l.player_id}>
            <NomeJogador>
              <Avatar nome={l.jogador.nome} url={l.jogador.foto_url} tamanho="xs" />
              <span title={l.jogador.nome}>{l.jogador.nome}</span>
            </NomeJogador>
            <ParDeBotoes>
              <BotaoGol
                type="button"
                disabled={!golLiberado}
                onClick={() => registrar('NORMAL_GOAL', equipe.id, l.player_id)}
              >
                GOL
              </BotaoGol>
              <BotaoGol
                type="button"
                $goleiro
                disabled={!golLiberado}
                onClick={() => registrar('KEEPER_GOAL', equipe.id, l.player_id)}
              >
                GOLEIRO
              </BotaoGol>
            </ParDeBotoes>
          </BlocoJogador>
        ))}

        <BotaoAuxiliar
          type="button"
          disabled={!golLiberado}
          onClick={() => setEscolhendoContra(equipe.id)}
        >
          GOL CONTRA
        </BotaoAuxiliar>

        <BotaoAuxiliar
          type="button"
          disabled={!podeOperar || ocupado || partida.status === 'FINISHED'}
          onClick={() => desfazerUltimo(equipe.id)}
        >
          <Minus size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> DESFAZER
        </BotaoAuxiliar>

        <ResumoTime>
          {linha.goals} {linha.goals === 1 ? 'gol' : 'gols'} · {linha.keeperGoals} de goleiro ·{' '}
          {linha.ownGoals} contra
        </ResumoTime>
      </PainelTime>
    )
  }

  const equipeDoContra = escolhendoContra === equipeA.id ? equipeA : equipeB
  const jogadoresDoContra =
    escolhendoContra === null ? [] : escalacao.filter((l) => l.team_id === escolhendoContra)

  return (
    <>
      <Navegacao />
      <Pagina $estreita>
        <Bloco>
          <Rotulo $cor="acento">
            {partida.phase_kind === 'GROUP' ? 'Fase de grupos' : 'Mata-mata'}
          </Rotulo>
          <h1 style={{ fontSize: 22 }}>{partida.label}</h1>
        </Bloco>

        <Placar $ouro={emOuro}>
          <TopoPlacar>
            <Badge $tom={emOuro ? 'ouro' : partida.status === 'LIVE' ? 'aoVivo' : 'claro'}>
              {(partida.status === 'LIVE' || emOuro) && <PontoAoVivo />}
              {emOuro
                ? 'Gol de ouro'
                : partida.status === 'LIVE'
                  ? 'Ao vivo'
                  : partida.status === 'PAUSED'
                    ? 'Pausada'
                    : partida.status === 'FINISHED'
                      ? 'Encerrada'
                      : 'A começar'}
            </Badge>
            {tempoEsgotado && <Badge $tom="claro">Tempo esgotado</Badge>}
          </TopoPlacar>

          <Corpo>
            <div>
              <NomeLado>{equipeA.nome}</NomeLado>
              <Gol>{placar.teamA.gf}</Gol>
              <Detalhe>
                {placar.teamA.goals} gols · {placar.teamA.keeperGoals} de goleiro
              </Detalhe>
            </div>
            <Texto $claro>×</Texto>
            <div>
              <NomeLado>{equipeB.nome}</NomeLado>
              <Gol>{placar.teamB.gf}</Gol>
              <Detalhe>
                {placar.teamB.goals} gols · {placar.teamB.keeperGoals} de goleiro
              </Detalhe>
            </div>
          </Corpo>

          <Cronometro $alerta={tempoEsgotado || acabando} $pulsando={emOuro || acabando}>
            <p>
              {emOuro ? '+' : ''}
              {tempo}
            </p>
            {!relogioPronto && <Detalhe>sincronizando relógio…</Detalhe>}
          </Cronometro>
        </Placar>

        {!relogioPronto && (
          <AvisoConexao role="status">
            <WifiOff size={16} aria-hidden="true" />
            Ajustando o relógio com o servidor antes de liberar os registros.
          </AvisoConexao>
        )}

        {/* Nunca fingir tempo real quando o canal caiu (§13 do redesign). */}
        {!sincronizado && (
          <AvisoConexao role="status">
            <WifiOff size={16} aria-hidden="true" />
            <span style={{ flex: 1 }}>Sem atualização automática — os lances podem atrasar.</span>
            <Botao
              type="button"
              $variante="contorno"
              $tamanho="sm"
              onClick={() => void recarregar()}
            >
              Atualizar
            </Botao>
          </AvisoConexao>
        )}

        {erroAcao !== null && <Erro>{erroAcao}</Erro>}

        {partida.status === 'SCHEDULED' && podeIniciar && (
          <Botao type="button" $tamanho="lg" $bloco onClick={() => setConfirmandoInicio(true)}>
            <Play size={18} aria-hidden="true" />
            Iniciar partida
          </Botao>
        )}

        {podeOperar && emAndamento && (
          <Acoes>
            {partida.status === 'PAUSED' ? (
              <Botao
                type="button"
                $tamanho="lg"
                $bloco
                disabled={ocupado}
                onClick={() =>
                  void executar(() => supabase.rpc('retomar_partida', { p_match_id: partida.id }))
                }
              >
                <Play size={18} aria-hidden="true" />
                Retomar
              </Botao>
            ) : (
              <Botao
                type="button"
                $variante="contorno"
                $tamanho="lg"
                $bloco
                disabled={ocupado}
                onClick={() =>
                  void executar(() => supabase.rpc('pausar_partida', { p_match_id: partida.id }))
                }
              >
                <Pause size={18} aria-hidden="true" />
                Pausar
              </Botao>
            )}
            <Botao
              type="button"
              $variante="secundario"
              $tamanho="lg"
              $bloco
              disabled={ocupado}
              onClick={() => setConfirmandoFim(true)}
            >
              <Square size={16} aria-hidden="true" />
              Encerrar
            </Botao>
          </Acoes>
        )}

        {podeOperar && emAndamento && (
          <Times>
            {painel(equipeA, 'A')}
            {painel(equipeB, 'B')}
          </Times>
        )}

        {!podeOperar && partida.status !== 'FINISHED' && (
          <Texto $pequeno $mudo>
            Você está acompanhando como espectador. O placar atualiza sozinho.
          </Texto>
        )}

        <Bloco>
          <TituloSecao>
            <h2>Eventos</h2>
          </TituloSecao>
          {linhasDeEvento.length === 0 ? (
            <Vazio titulo="Nada aconteceu ainda" descricao="Os lances aparecem aqui em tempo real." />
          ) : (
            <Cartao $compacto>
              <Feed>
                {[...linhasDeEvento].reverse().map((e) => {
                  const removido = linhasDeEvento.some(
                    (r) => r.type === 'GOAL_REMOVED' && r.removed_event_id === e.id,
                  )
                  const autor = escalacao.find((l) => l.player_id === e.player_id)?.jogador.nome
                  const texto = `${ROTULO_EVENTO[e.type] ?? e.type}${autor !== undefined ? ` — ${autor}` : ''}`
                  return (
                    <li key={e.id}>
                      {removido ? <Riscado>{texto}</Riscado> : <span>{texto}</span>}
                      <Relogio>{formatClock(Math.min(e.clock_ms, MATCH_DURATION_MS))}</Relogio>
                    </li>
                  )
                })}
              </Feed>
            </Cartao>
          )}
        </Bloco>
      </Pagina>

      {/* Gol contra: escolher o autor é obrigatório, então vira um passo próprio. */}
      <Modal
        aberto={escolhendoContra !== null}
        titulo="Quem fez o gol contra?"
        aoFechar={() => setEscolhendoContra(null)}
      >
        <Texto $pequeno $mudo>
          O gol vale 1 e é creditado ao time adversário — mesmo que o autor seja o goleiro. Ele não
          conta como gol oficial do jogador e desconta 1 da artilharia líquida dele.
        </Texto>
        <Texto $pequeno>
          <strong>{equipeDoContra.nome}</strong>
        </Texto>
        {jogadoresDoContra.map((l) => (
          <Botao
            key={l.player_id}
            type="button"
            $variante="contorno"
            $tamanho="lg"
            $bloco
            disabled={!golLiberado}
            onClick={() => {
              const equipeId = escolhendoContra
              setEscolhendoContra(null)
              if (equipeId !== null) registrar('OWN_GOAL', equipeId, l.player_id)
            }}
          >
            {l.jogador.nome}
          </Botao>
        ))}
      </Modal>

      <Confirmacao
        aberto={confirmandoInicio}
        titulo="Iniciar esta partida?"
        descricao="Você está prestes a iniciar esta partida. Depois de iniciar, o cronômetro começa a correr e ela fica disponível para acompanhamento em tempo real."
        exigirCiencia="Estou ciente de que o cronômetro começa agora."
        rotuloConfirmar="Iniciar partida"
        ocupado={ocupado}
        aoCancelar={() => setConfirmandoInicio(false)}
        aoConfirmar={() => {
          setConfirmandoInicio(false)
          void executar(() => supabase.rpc('iniciar_partida', { p_match_id: partida.id }))
        }}
      />

      <Confirmacao
        aberto={confirmandoFim}
        titulo="Encerrar a partida?"
        descricao="O placar atual passa a valer para a classificação e para as estatísticas. Depois disso, só um administrador pode corrigir os eventos."
        rotuloConfirmar="Encerrar agora"
        ocupado={ocupado}
        aoCancelar={() => setConfirmandoFim(false)}
        aoConfirmar={() => {
          setConfirmandoFim(false)
          void executar(() => supabase.rpc('encerrar_partida', { p_match_id: partida.id }))
        }}
      />
    </>
  )
}
