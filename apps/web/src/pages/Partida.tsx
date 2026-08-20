/**
 * Operação da partida ao vivo — a tela mais importante do produto.
 *
 * Prioridades (§41): botões grandes, retorno imediato, estado do jogo sempre
 * legível a um metro de distância. O placar exibido é o valor PONDERADO; a
 * quantidade física de gols aparece separada logo abaixo, para que 21 no
 * placar nunca seja confundido com 21 gols (§31).
 *
 * A tela é pública: o espectador sem conta acompanha tudo em tempo real e não
 * vê nenhum botão de ação (§40). Esconder o botão é conveniência — quem barra
 * de fato é a RLS e as funções do banco (§45).
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import styled, { css, keyframes } from 'styled-components'
import {
  MATCH_DURATION_MS,
  displayMs,
  formatClock,
  isRegulationOver,
  canRegisterGoal,
} from '@pebolim/domain'
import type { GoalEventType } from '@pebolim/domain'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { useAuth } from '../auth/useAuth'
import { usePapeis } from '../auth/usePapeis'
import { usePartida } from '../partida/usePartida'
import { paraRelogioDoDominio } from '../partida/adaptadores'
import { useRelogioServidor } from '../partida/useRelogioServidor'
import { Alerta, Botao, BotaoSecundario } from '../components/Formulario'
import { Kicker, Note } from '../components/Shell'

const Tela = styled.main`
  min-height: 100dvh;
  max-width: ${({ theme }) => theme.layout.appMaxWidth};
  margin: 0 auto;
  padding: ${({ theme }) => theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`

const Placar = styled.section`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  border: 2px solid ${({ theme }) => theme.color.text};
  padding: ${({ theme }) => theme.space[4]};
  background: ${({ theme }) => theme.color.neutral[100]};
`

const LadoDoPlacar = styled.div`
  text-align: center;
  min-width: 0;

  h2 {
    font-size: 13px;
    margin: 0 0 ${({ theme }) => theme.space[2]};
    overflow-wrap: anywhere;
  }
`

const Numero = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.font.heading};
  font-weight: ${({ theme }) => theme.font.headingWeight};
  font-size: 56px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
`

const Detalhe = styled.p`
  margin: ${({ theme }) => theme.space[2]} 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: ${({ theme }) => theme.color.muted};
`

const pulsar = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
`

const Cronometro = styled.section<{ $ouro: boolean; $esgotado: boolean }>`
  text-align: center;
  border: 2px solid
    ${({ theme, $ouro, $esgotado }) =>
      $ouro || $esgotado ? theme.color.accent : theme.color.divider};
  padding: ${({ theme }) => theme.space[3]};
  background: ${({ theme, $ouro }) => ($ouro ? theme.color.accentRamp[100] : 'transparent')};

  p {
    margin: 0;
    font-family: ${({ theme }) => theme.font.heading};
    font-weight: ${({ theme }) => theme.font.headingWeight};
    font-size: 44px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  ${({ $ouro }) =>
    $ouro &&
    css`
      animation: ${pulsar} 1.6s ease-in-out infinite;
    `}
`

const Faixa = styled.p<{ $destaque?: boolean }>`
  margin: 0 0 ${({ theme }) => theme.space[2]};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${({ theme, $destaque }) => ($destaque ? theme.color.accent : theme.color.muted)};
`

const Times = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.space[3]};
`

const PainelTime = styled.div`
  border: 2px solid ${({ theme }) => theme.color.divider};
  padding: ${({ theme }) => theme.space[2]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};

  h3 {
    font-size: 12px;
    margin: 0;
    text-align: center;
    overflow-wrap: anywhere;
  }
`

const LinhaJogador = styled.div`
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
`

const NomeJogador = styled.span`
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

/** Alvo grande e rotulado: nada de ícone solto no meio da partida (§41). */
const BotaoGol = styled.button<{ $goleiro?: boolean }>`
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  min-width: 54px;
  min-height: 48px;
  padding: 0 ${({ theme }) => theme.space[2]};
  cursor: pointer;
  color: ${({ theme, $goleiro }) => ($goleiro ? theme.color.neutral[100] : theme.color.text)};
  background: ${({ theme, $goleiro }) => ($goleiro ? theme.color.accent : 'transparent')};
  border: 2px solid ${({ theme, $goleiro }) => ($goleiro ? theme.color.accent : theme.color.text)};

  &:active:not(:disabled) {
    transform: scale(0.96);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`

const BotaoLargo = styled(BotaoGol)`
  width: 100%;
  min-height: 44px;
  font-size: 10px;
`

const Controles = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[3]};

  button {
    flex: 1;
  }
`

const Feed = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};

  li {
    display: flex;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space[2]};
    font-size: 13px;
    border-bottom: 1px solid ${({ theme }) => theme.color.divider};
    padding-bottom: ${({ theme }) => theme.space[2]};
  }
`

const Riscado = styled.span`
  text-decoration: line-through;
  color: ${({ theme }) => theme.color.muted};
`

const ROTULO_EVENTO: Record<string, string> = {
  NORMAL_GOAL: 'Gol',
  KEEPER_GOAL: 'Gol de goleiro (2)',
  OWN_GOAL: 'Gol contra (1)',
  GOAL_REMOVED: 'Gol removido',
  MATCH_STARTED: 'Início',
  MATCH_PAUSED: 'Pausa',
  MATCH_RESUMED: 'Retomada',
  GOLDEN_GOAL_STARTED: 'Gol de ouro',
  MATCH_FINISHED: 'Fim',
}

export default function Partida() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { ehAdmin } = usePapeis()
  const { dados, carregando, erro, recarregar } = usePartida(id)
  const { agora, pronto: relogioPronto } = useRelogioServidor()

  const [, redesenhar] = useState(0)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [escolhendoContra, setEscolhendoContra] = useState<string | null>(null)

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
      if (error) setErroAcao(error.message)
      else await recarregar()
      setOcupado(false)
    },
    [recarregar],
  )

  if (carregando) return <Tela>Carregando partida…</Tela>
  if (erro !== null || dados === null) {
    return (
      <Tela>
        <Alerta>{erro ?? 'Partida não encontrada.'}</Alerta>
        <Link to="/home">Voltar</Link>
      </Tela>
    )
  }

  const { partida, equipeA, equipeB, escalacao, placar, linhasDeEvento } = dados
  const relogio = paraRelogioDoDominio(partida)
  const instante = agora()
  const emOuro = partida.status === 'GOLDEN_GOAL'
  const tempoEsgotado = partida.status === 'LIVE' && isRegulationOver(relogio, instante)
  const tempo = formatClock(displayMs(relogio, partida.status, instante))

  // Espelha is_operador_da_partida do banco. A decisão real é do servidor.
  const souEscalado = escalacao.some((l) => l.jogador.profile_id === user?.id)
  const souArbitro = partida.arbitro_user_id === user?.id
  const podeOperar = user !== null && (ehAdmin || souArbitro || souEscalado)
  const podeIniciar = user !== null && partida.status === 'SCHEDULED'

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
          <LinhaJogador key={l.player_id}>
            <NomeJogador title={l.jogador.nome}>{l.jogador.nome}</NomeJogador>
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
          </LinhaJogador>
        ))}

        {escolhendoContra === equipe.id ? (
          <>
            <Faixa $destaque>Quem fez contra?</Faixa>
            {jogadores.map((l) => (
              <BotaoLargo
                key={l.player_id}
                type="button"
                disabled={!golLiberado}
                onClick={() => {
                  setEscolhendoContra(null)
                  registrar('OWN_GOAL', equipe.id, l.player_id)
                }}
              >
                {l.jogador.nome}
              </BotaoLargo>
            ))}
            <BotaoLargo type="button" onClick={() => setEscolhendoContra(null)}>
              Cancelar
            </BotaoLargo>
          </>
        ) : (
          <>
            <BotaoLargo
              type="button"
              disabled={!golLiberado}
              onClick={() => setEscolhendoContra(equipe.id)}
            >
              Gol contra
            </BotaoLargo>
            <BotaoLargo
              type="button"
              disabled={!podeOperar || ocupado || partida.status === 'FINISHED'}
              onClick={() => desfazerUltimo(equipe.id)}
            >
              Desfazer último
            </BotaoLargo>
          </>
        )}

        <Detalhe>
          {linha.goals} gols · {linha.keeperGoals} de goleiro · {linha.ownGoals} contra
        </Detalhe>
      </PainelTime>
    )
  }

  return (
    <Tela>
      <div>
        <Kicker>{partida.label}</Kicker>
        <Faixa>
          {partida.phase_kind === 'GROUP' ? 'Fase de grupos' : 'Mata-mata'} · {partida.status}
        </Faixa>
      </div>

      <Placar>
        <LadoDoPlacar>
          <h2>{equipeA.nome}</h2>
          <Numero>{placar.teamA.gf}</Numero>
        </LadoDoPlacar>
        <span>×</span>
        <LadoDoPlacar>
          <h2>{equipeB.nome}</h2>
          <Numero>{placar.teamB.gf}</Numero>
        </LadoDoPlacar>
      </Placar>

      <Cronometro $ouro={emOuro} $esgotado={tempoEsgotado}>
        {emOuro && <Faixa $destaque>Gol de ouro</Faixa>}
        {tempoEsgotado && <Faixa $destaque>Tempo esgotado</Faixa>}
        <p>
          {emOuro ? '+' : ''}
          {tempo}
        </p>
        {!relogioPronto && <Detalhe>sincronizando relógio…</Detalhe>}
      </Cronometro>

      {erroAcao !== null && <Alerta>{erroAcao}</Alerta>}

      {partida.status === 'SCHEDULED' && podeIniciar && (
        <Botao
          type="button"
          disabled={ocupado}
          onClick={() => void executar(() => supabase.rpc('iniciar_partida', { p_match_id: partida.id }))}
        >
          Iniciar partida
        </Botao>
      )}

      {podeOperar && (partida.status === 'LIVE' || emOuro || partida.status === 'PAUSED') && (
        <Controles>
          {partida.status === 'PAUSED' ? (
            <Botao
              type="button"
              disabled={ocupado}
              onClick={() =>
                void executar(() => supabase.rpc('retomar_partida', { p_match_id: partida.id }))
              }
            >
              Retomar
            </Botao>
          ) : (
            <BotaoSecundario
              type="button"
              disabled={ocupado}
              onClick={() =>
                void executar(() => supabase.rpc('pausar_partida', { p_match_id: partida.id }))
              }
            >
              Pausar
            </BotaoSecundario>
          )}
          <Botao
            type="button"
            disabled={ocupado}
            onClick={() =>
              void executar(() => supabase.rpc('encerrar_partida', { p_match_id: partida.id }))
            }
          >
            Encerrar
          </Botao>
        </Controles>
      )}

      {partida.status !== 'SCHEDULED' && partida.status !== 'FINISHED' && (
        <Times>
          {painel(equipeA, 'A')}
          {painel(equipeB, 'B')}
        </Times>
      )}

      {!podeOperar && partida.status !== 'FINISHED' && (
        <Note>Você está acompanhando como espectador.</Note>
      )}

      <section>
        <Faixa>Eventos</Faixa>
        <Feed>
          {[...linhasDeEvento].reverse().map((e) => {
            const removido = linhasDeEvento.some(
              (r) => r.type === 'GOAL_REMOVED' && r.removed_event_id === e.id,
            )
            const autor = escalacao.find((l) => l.player_id === e.player_id)?.jogador.nome
            const texto = `${ROTULO_EVENTO[e.type] ?? e.type}${autor ? ` — ${autor}` : ''}`
            return (
              <li key={e.id}>
                {removido ? <Riscado>{texto}</Riscado> : <span>{texto}</span>}
                <span>{formatClock(Math.min(e.clock_ms, MATCH_DURATION_MS))}</span>
              </li>
            )
          })}
        </Feed>
        {linhasDeEvento.length === 0 && <Note>Nada aconteceu ainda.</Note>}
      </section>

      <Link to="/home">Voltar</Link>
    </Tela>
  )
}
