/**
 * Bracket gráfico do mata-mata simples.
 *
 * A montagem e a resolução da chave são as mesmas funções puras que o banco
 * espelha (`montarMataMata` / `resolverMataMata` em @pebolim/domain) — esta
 * tela só desenha o resultado, nunca decide quem avança (§50). Como os dados
 * vêm de `useCampeonato`, que já mantém um canal Realtime aberto para
 * `matches`, o desenho atualiza sozinho conforme os confrontos são decididos,
 * sem precisar recarregar a página (§38).
 *
 * A leitura é da esquerda para a direita: rodadas eliminatórias, grande final
 * e, embaixo, a disputa de 3º lugar — que não faz parte do caminho do título e
 * por isso não fica na mesma trilha.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { montarMataMata, podioDoMataMata, resolverMataMata } from '@pebolim/domain'
import type {
  PlanoDeMataMata,
  ResultadosDeMataMata,
  SlotDeMataMataResolvido,
} from '@pebolim/domain'
import type { PartidaComContexto, LinhaEquipe, LinhaFase } from '../dados/campeonato'
import { midia } from '../design-system/tokens'

const Raiz = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[6]};

  ${midia.md} {
    gap: ${({ theme }) => theme.space[7]};
  }
`

const Ala = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
`

const TituloAla = styled.h3`
  font-size: ${({ theme }) => theme.fontSize.small};
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.muted};
  margin: 0;
`

const Rolagem = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[6]};
  overflow-x: auto;
  padding-bottom: ${({ theme }) => theme.space[3]};
  -webkit-overflow-scrolling: touch;
`

const Colunas = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[4]};
`

const Coluna = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  gap: ${({ theme }) => theme.space[3]};
  min-width: 220px;
`

const RotuloRodada = styled.p`
  margin: 0 0 ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.fontSize.micro};
  font-weight: 700;
  color: ${({ theme }) => theme.color.muted};
  text-align: center;
`

const CartaoSlot = styled.div<{ $clicavel?: boolean }>`
  display: block;
  text-decoration: none;
  color: inherit;
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surface};
  overflow: hidden;
  ${({ $clicavel }) => $clicavel === true && `cursor: pointer;`}
`

const LadoSlot = styled.div<{ $vencedor?: boolean; $vazio?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.fontSize.caption};
  font-weight: ${({ $vencedor }) => ($vencedor === true ? 800 : 600)};
  color: ${({ theme, $vazio }) => ($vazio === true ? theme.color.muted : theme.color.text)};
  background: ${({ theme, $vencedor }) =>
    $vencedor === true ? theme.color.campo[50] : 'transparent'};

  span:first-child {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span:last-child {
    flex-shrink: 0;
    font-family: ${({ theme }) => theme.font.numero};
    font-variant-numeric: tabular-nums;
  }

  & + & {
    border-top: 1px solid ${({ theme }) => theme.color.borderSoft};
  }
`

const Vazio = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.space[5]};
  text-align: center;
  color: ${({ theme }) => theme.color.muted};
  font-size: ${({ theme }) => theme.fontSize.small};
`

const Eliminadas = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.micro};
  color: ${({ theme }) => theme.color.muted};
`

interface ChaveamentoArmazenado {
  ordem: string[]
  plano: { inscritas: number }
}

/** Type guard tosco: só o suficiente para não estourar em runtime com um JSON inesperado. */
function comoChaveamento(valor: unknown): ChaveamentoArmazenado | null {
  if (valor === null || typeof valor !== 'object') return null
  const v = valor as Record<string, unknown>
  if (!Array.isArray(v.ordem) || typeof v.plano !== 'object' || v.plano === null) return null
  const plano = v.plano as Record<string, unknown>
  if (typeof plano.inscritas !== 'number') return null
  return { ordem: v.ordem as string[], plano: { inscritas: plano.inscritas } }
}

function nomeDaEquipe(equipes: readonly LinhaEquipe[], id: string | null): string {
  if (id === null) return '—'
  return equipes.find((e) => e.id === id)?.nome ?? '—'
}

export function ChaveDoMataMata({
  fase,
  partidas,
  equipes,
}: {
  fase: LinhaFase
  partidas: readonly PartidaComContexto[]
  equipes: readonly LinhaEquipe[]
}) {
  const chaveamento = comoChaveamento(fase.chaveamento)

  const plano: PlanoDeMataMata | null = useMemo(() => {
    if (chaveamento === null) return null
    return montarMataMata(chaveamento.plano.inscritas)
  }, [chaveamento])

  const daFase = useMemo(
    () => partidas.filter((p) => p.linha.phase_id === fase.id),
    [partidas, fase.id],
  )

  const porSlot = useMemo(() => {
    const mapa = new Map<string, PartidaComContexto>()
    for (const p of daFase) {
      if (p.linha.slot !== null) mapa.set(p.linha.slot, p)
    }
    return mapa
  }, [daFase])

  const resolvidos = useMemo(() => {
    if (plano === null || chaveamento === null) return null
    const vencedorPorSlot = new Map<string, string>()
    for (const p of daFase) {
      if (p.linha.slot === null || p.linha.status !== 'FINISHED') continue
      if (p.linha.team_a_id === null || p.linha.team_b_id === null) continue
      // Empate não decide nada: no mata-mata a partida vai ao gol de ouro, e
      // enquanto não houver vencedor a chave não anda (§37).
      if (p.placarA === p.placarB) continue
      const vencedor = p.placarA > p.placarB ? p.linha.team_a_id : p.linha.team_b_id
      vencedorPorSlot.set(p.linha.slot, vencedor)
    }
    const resultados: ResultadosDeMataMata = { vencedorPorSlot }
    return resolverMataMata(plano, chaveamento.ordem, resultados)
  }, [plano, chaveamento, daFase])

  const podio = useMemo(
    () => (resolvidos === null ? null : podioDoMataMata(resolvidos)),
    [resolvidos],
  )

  if (resolvidos === null || plano === null || chaveamento === null) {
    return <Vazio>A chave ainda não foi montada.</Vazio>
  }

  /** Quem não passou pelo corte: está no torneio, mas fora da chave. */
  const foraDoCorte = equipes.filter((e) => !chaveamento.ordem.includes(e.id))

  const desenhar = (slot: SlotDeMataMataResolvido) => {
    const partida = porSlot.get(slot.id)
    const conteudo = (
      <>
        <LadoSlot
          $vencedor={slot.vencedor !== null && slot.vencedor === slot.equipeA}
          $vazio={slot.equipeA === null}
        >
          <span>{nomeDaEquipe(equipes, slot.equipeA)}</span>
          {partida !== undefined && <span>{partida.placarA}</span>}
        </LadoSlot>
        <LadoSlot
          $vencedor={slot.vencedor !== null && slot.vencedor === slot.equipeB}
          $vazio={slot.equipeB === null}
        >
          <span>{nomeDaEquipe(equipes, slot.equipeB)}</span>
          {partida !== undefined && <span>{partida.placarB}</span>}
        </LadoSlot>
      </>
    )
    return partida !== undefined ? (
      <CartaoSlot as={Link} to={`/matches/${partida.linha.id}`} key={slot.id} $clicavel>
        {conteudo}
      </CartaoSlot>
    ) : (
      <CartaoSlot key={slot.id}>{conteudo}</CartaoSlot>
    )
  }

  // O caminho do título: eliminatórias e final, lado a lado. O jogo de
  // desempate da final só entra quando a série realmente empata em 1 a 1.
  const caminho = resolvidos.filter(
    (s) => s.chave !== 'TERCEIRO_LUGAR' && s.estado !== 'DISPENSADO',
  )
  const rodadas = [...new Set(caminho.map((s) => s.rodada))].sort((a, b) => a - b)
  const terceiro = resolvidos.find((s) => s.chave === 'TERCEIRO_LUGAR')

  return (
    <Raiz>
      <Ala>
        <TituloAla>Caminho do título</TituloAla>
        <Rolagem>
          <Colunas>
            {rodadas.map((rodada) => {
              const daRodada = caminho
                .filter((s) => s.rodada === rodada)
                .sort((a, b) => a.posicao - b.posicao)
              const daFinal = daRodada[0]?.chave === 'FINAL'
              return (
                <Coluna key={rodada}>
                  <RotuloRodada>{daFinal ? 'Grande final' : daRodada[0]?.rotulo}</RotuloRodada>
                  {daRodada.map(desenhar)}
                </Coluna>
              )
            })}
          </Colunas>
        </Rolagem>
        {foraDoCorte.length > 0 && (
          <Eliminadas>
            Fora do corte: {foraDoCorte.map((e) => e.nome).join(', ')} — a chave é de{' '}
            {plano.tamanhoDaChave} equipes.
          </Eliminadas>
        )}
      </Ala>

      {terceiro !== undefined && (
        <Ala>
          <TituloAla>Disputa de 3º lugar</TituloAla>
          <Rolagem>
            <Colunas>
              <Coluna>
                <RotuloRodada>Bronze</RotuloRodada>
                {desenhar(terceiro)}
              </Coluna>
            </Colunas>
          </Rolagem>
        </Ala>
      )}

      {/*
        Cada posição aparece assim que é decidida, e não quando o pódio inteiro
        fica pronto: o bronze costuma sair antes da final, e segurá-lo aqui
        esconderia uma conquista que já aconteceu.
      */}
      {podio !== null &&
        (podio.campeao !== null || podio.terceiro !== null) && (
          <Ala>
            <TituloAla>Pódio</TituloAla>
            <Eliminadas>
              {podio.campeao !== null && <>🥇 {nomeDaEquipe(equipes, podio.campeao)}</>}
              {podio.campeao !== null && podio.vice !== null && (
                <> · 🥈 {nomeDaEquipe(equipes, podio.vice)}</>
              )}
              {podio.terceiro !== null && (
                <>
                  {podio.campeao !== null && ' · '}🥉 {nomeDaEquipe(equipes, podio.terceiro)}
                </>
              )}
              {podio.campeao === null && ' — a final ainda decide ouro e prata.'}
            </Eliminadas>
          </Ala>
        )}
    </Raiz>
  )
}
