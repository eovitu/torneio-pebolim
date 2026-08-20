/**
 * Perfil público de um jogador.
 *
 * É a peça que faltava para o produto parecer uma pequena rede social do
 * campeonato: qualquer nome, em qualquer lista, leva até aqui (§11 do
 * redesign).
 *
 * Tudo vem de `players`, `teams` e `match_events` — tabelas de leitura
 * pública. `profiles` continua privado e nada dele aparece nesta tela: nem
 * e-mail, nem data de nascimento (§45).
 */

import { useParams } from 'react-router-dom'
import styled from 'styled-components'
import { UserRound } from 'lucide-react'
import { Navegacao } from '../components/Navegacao'
import { CartaoDePartida, GradeDeNumeros, Numero } from '../components/Cartoes'
import { useJogadorPublico } from '../dados/hooks'
import { ROTULO_STATUS_TORNEIO } from '../dados/campeonato'
import { Bloco, Cartao, Grade, Pagina, Painel, Rotulo, Texto, TituloSecao } from '../ui/Superficie'
import { BotaoLink } from '../ui/Botao'
import { Carregando, Vazio } from '../ui/Estados'
import { Avatar, Badge } from '../ui/Etiqueta'
import { midia } from '../design-system/tokens'

const Cabecalho = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space[5]};

  h1 {
    font-size: ${({ theme }) => theme.fontSize.h2};
    overflow-wrap: anywhere;
  }
`

const Lista = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[3]};

  ${midia.md} {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
`

export default function Jogador() {
  const { id = '' } = useParams()
  const { perfil, carregando, erro } = useJogadorPublico(id)

  if (carregando) {
    return (
      <>
        <Navegacao />
        <Pagina>
          <Carregando linhas={3} rotulo="Carregando perfil…" />
        </Pagina>
      </>
    )
  }

  if (perfil === null) {
    return (
      <>
        <Navegacao />
        <Pagina>
          <Vazio
            icone={<UserRound size={26} />}
            titulo="Jogador não encontrado"
            descricao={erro ?? 'Este perfil não existe.'}
            acao={
              <BotaoLink to="/home" $variante="primario">
                Voltar ao início
              </BotaoLink>
            }
          />
        </Pagina>
      </>
    )
  }

  const { jogador, estatisticas: s, times, partidas } = perfil
  const encerradas = partidas.filter((p) => p.linha.status === 'FINISHED').reverse()

  return (
    <>
      <Navegacao />
      <Pagina>
        <Painel>
          <Cabecalho>
            <Avatar nome={jogador.nome} url={jogador.foto_url} tamanho="xl" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Rotulo style={{ color: 'rgba(255,255,255,.65)' }}>Jogador</Rotulo>
              <h1>{jogador.nome}</h1>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Badge $tom="claro">
                  {times.length === 1 ? '1 time' : `${times.length} times`}
                </Badge>
                <Badge $tom="claro">{s.j === 1 ? '1 partida' : `${s.j} partidas`}</Badge>
                {s.artilhariaLiquida > 0 && (
                  <Badge $tom="ouro">{s.artilhariaLiquida} de artilharia</Badge>
                )}
              </div>
            </div>
          </Cabecalho>
        </Painel>

        <Bloco>
          <TituloSecao>
            <h2>Números</h2>
          </TituloSecao>
          <GradeDeNumeros>
            <Numero valor={s.artilhariaLiquida} rotulo="artilharia" destaque />
            <Numero valor={s.goals} rotulo="gols" />
            <Numero valor={s.keeperGoals} rotulo="de goleiro" />
            <Numero valor={s.ownGoals} rotulo="contra" />
            <Numero valor={s.j} rotulo="jogos" />
            <Numero valor={s.v} rotulo="vitórias" />
            <Numero valor={s.e} rotulo="empates" />
            <Numero valor={s.d} rotulo="derrotas" />
          </GradeDeNumeros>
          <Texto $pequeno $mudo>
            &quot;Gols&quot; é a quantidade de bolas que entraram; a artilharia é o valor delas —
            gol de goleiro vale 2 e cada gol contra desconta 1. Gol contra não conta como gol
            oficial do jogador.
          </Texto>
        </Bloco>

        <Bloco>
          <TituloSecao>
            <h2>Times</h2>
          </TituloSecao>
          {times.length === 0 ? (
            <Vazio titulo="Ainda não jogou por nenhum time" />
          ) : (
            <Grade $min="240px">
              {times.map(({ equipe, torneio }) => (
                <Cartao key={equipe.id} $compacto>
                  <Rotulo $cor="marca">{ROTULO_STATUS_TORNEIO[torneio.status]}</Rotulo>
                  <h3 style={{ margin: '6px 0 4px' }}>{equipe.nome}</h3>
                  <Texto $pequeno $mudo>
                    {torneio.nome}
                  </Texto>
                  <BotaoLink
                    to={`/teams/${equipe.id}`}
                    $variante="contorno"
                    $bloco
                    style={{ marginTop: 12 }}
                  >
                    Ver time
                  </BotaoLink>
                </Cartao>
              ))}
            </Grade>
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
                  contexto={p.nomeTorneio}
                />
              ))}
            </Lista>
          )}
        </Bloco>
      </Pagina>
    </>
  )
}
