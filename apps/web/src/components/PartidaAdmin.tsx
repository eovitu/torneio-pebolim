/**
 * Controles de administração de uma partida: regra de término e exclusão.
 *
 * REGRA DE TÉRMINO (§ Bloco D)
 *
 * A partida pode acabar por TEMPO (os 3 minutos de sempre) ou por GOLS (assim
 * que uma equipe bate a meta). O padrão é do torneio; aqui o admin sobrescreve
 * só a exceção. "Herdar" não é o mesmo que escolher TEMPO: herdando, mudar o
 * padrão do campeonato muda esta partida junto.
 *
 * Só antes da bola rolar. Mudar a regra com a partida em andamento seria mudar
 * as condições do jogo no meio dele — o banco recusa, e a tela nem oferece.
 *
 * EXCLUIR ≠ CANCELAR
 *
 * Excluir tira a partida de vez, com os eventos dela. É para desfazer partida
 * criada por engano. Como não dá para desfazer, exige confirmação — e o texto
 * avisa quando há gols registrados, que é o caso em que o clique dói.
 */

import { useState } from 'react'
import styled from 'styled-components'
import { Settings2, Trash2 } from 'lucide-react'
import { descreverTermino, metaValida, regraEfetiva } from '@pebolim/domain'
import type { CondicaoDeTermino, RegraDeTermino } from '@pebolim/domain'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { Acoes, Botao } from '../ui/Botao'
import { Texto } from '../ui/Superficie'
import { Entrada, Selecao } from './Formulario'
import { Confirmacao } from '../ui/Modal'

const Barra = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  border: 1px dashed ${({ theme }) => theme.color.borderSoft};
  border-radius: ${({ theme }) => theme.radius.sm};
`

const Painel = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[2]};
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
`

/** `null` na condição da partida = herda o padrão do torneio. */
type Escolha = 'HERDAR' | CondicaoDeTermino

export function PartidaAdmin({
  partida,
  padraoDoTorneio,
  ocupado,
  executar,
}: {
  partida: Tables<'matches'>
  padraoDoTorneio: RegraDeTermino
  ocupado: boolean
  executar: (
    acao: () => PromiseLike<{ error: { message: string } | null }>,
    mensagem?: string,
  ) => Promise<void>
}) {
  const [abertoConfig, setAbertoConfig] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [escolha, setEscolha] = useState<Escolha>(partida.condicao_termino ?? 'HERDAR')
  const [meta, setMeta] = useState(String(partida.gols_para_vencer ?? padraoDoTorneio.golsParaVencer ?? 3))

  const regra = regraEfetiva(
    partida.condicao_termino === null
      ? null
      : { condicao: partida.condicao_termino, golsParaVencer: partida.gols_para_vencer },
    padraoDoTorneio,
  )

  const agendada = partida.status === 'SCHEDULED'
  const emAndamento = partida.status === 'LIVE' || partida.status === 'PAUSED' || partida.status === 'GOLDEN_GOAL'
  const metaNumero = Number(meta)
  const metaOk = escolha !== 'GOLS' || metaValida(metaNumero)

  const salvar = () =>
    void executar(
      () =>
        supabase.rpc('configurar_partida', {
          p_match_id: partida.id,
          p_condicao: escolha === 'HERDAR' ? null : escolha,
          p_gols: escolha === 'GOLS' ? metaNumero : null,
        }),
      'Regra de término salva.',
    ).then(() => setAbertoConfig(false))

  return (
    <Barra>
      <Texto $pequeno $mudo style={{ flex: '1 1 auto', minWidth: 0 }}>
        {descreverTermino(regra)}
        {partida.condicao_termino === null && ' · padrão do torneio'}
      </Texto>

      <Acoes>
        {agendada && (
          <Botao
            type="button"
            $variante="fantasma"
            $tamanho="sm"
            disabled={ocupado}
            onClick={() => setAbertoConfig((v) => !v)}
          >
            <Settings2 size={15} aria-hidden="true" />
            Configurar
          </Botao>
        )}
        {!emAndamento && (
          <Botao
            type="button"
            $variante="fantasma"
            $tamanho="sm"
            disabled={ocupado}
            onClick={() => setConfirmandoExclusao(true)}
          >
            <Trash2 size={15} aria-hidden="true" />
            Excluir
          </Botao>
        )}
      </Acoes>

      {abertoConfig && agendada && (
        <Painel>
          <Selecao
            aria-label="Como esta partida termina"
            value={escolha}
            onChange={(e) => setEscolha(e.target.value as Escolha)}
          >
            <option value="HERDAR">Usar o padrão do torneio</option>
            <option value="TEMPO">Por tempo — 3 minutos</option>
            <option value="GOLS">Por gols — acaba ao bater a meta</option>
          </Selecao>

          {escolha === 'GOLS' && (
            <Entrada
              type="number"
              min={1}
              max={20}
              step={1}
              aria-label="Gols para vencer"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
            />
          )}

          {escolha === 'GOLS' && !metaOk && (
            <Texto $pequeno $mudo>
              A meta precisa ser um número inteiro entre 1 e 20.
            </Texto>
          )}

          {escolha === 'GOLS' && metaOk && (
            <Texto $pequeno $mudo>
              O placar conta o valor dos gols: o de goleiro vale 2, então ele pode fechar a partida
              passando da meta.
            </Texto>
          )}

          <Acoes>
            <Botao type="button" $tamanho="sm" disabled={ocupado || !metaOk} onClick={salvar}>
              Salvar
            </Botao>
            <Botao
              type="button"
              $variante="fantasma"
              $tamanho="sm"
              disabled={ocupado}
              onClick={() => setAbertoConfig(false)}
            >
              Cancelar
            </Botao>
          </Acoes>
        </Painel>
      )}

      <Confirmacao
        aberto={confirmandoExclusao}
        titulo="Excluir esta partida?"
        descricao={
          partida.status === 'FINISHED'
            ? 'Esta partida já foi disputada. Excluir tira ela e os gols dela da classificação e das estatísticas. O registro completo fica guardado na auditoria, mas a partida não volta.'
            : 'A partida sai de vez, junto com os eventos dela. Isso não pode ser desfeito.'
        }
        rotuloConfirmar="Excluir partida"
        destrutivo
        ocupado={ocupado}
        aoCancelar={() => setConfirmandoExclusao(false)}
        aoConfirmar={() => {
          setConfirmandoExclusao(false)
          void executar(
            () => supabase.rpc('excluir_partida', { p_match_id: partida.id }),
            'Partida excluída.',
          )
        }}
      />
    </Barra>
  )
}
