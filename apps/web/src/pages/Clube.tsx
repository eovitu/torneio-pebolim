/**
 * Página do time que existe para sempre.
 *
 * Diferente de `/teams/:id`, que mostra a participação daquele time em UM
 * torneio, aqui a campanha é a soma de tudo o que o time já jogou — é o que
 * dá sentido a "o maior artilheiro da equipe fica".
 *
 * A tela é pública, como as demais páginas de time (§40).
 */

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import styled from 'styled-components'
import { Shield, Trophy } from 'lucide-react'
import { Navegacao } from '../components/Navegacao'
import { GradeDeNumeros, Numero } from '../components/Cartoes'
import { Artilharia } from '../components/Tabelas'
import { carregarClube } from '../dados/clube'
import type { Clube as DadosClube } from '../dados/clube'
import { Bloco, Cartao, Pagina, Painel, Rotulo, Texto, TituloSecao } from '../ui/Superficie'
import { BotaoLink } from '../ui/Botao'
import { Carregando, Vazio } from '../ui/Estados'
import { Avatar, Badge } from '../ui/Etiqueta'

const Topo = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space[5]};

  h1 {
    font-size: ${({ theme }) => theme.fontSize.h2};
    overflow-wrap: anywhere;
  }
`

const Escudo = styled.div<{ $cor?: string | null }>`
  display: grid;
  place-items: center;
  width: 86px;
  height: 86px;
  min-width: 86px;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme, $cor }) => $cor ?? theme.color.campo[500]};
  color: #fff;
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadow.md};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const Linha = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[3]};
  border-bottom: 1px solid ${({ theme }) => theme.color.borderSoft};
  font-size: ${({ theme }) => theme.fontSize.small};

  &:last-child {
    border-bottom: none;
  }

  > span:first-of-type {
    flex: 1;
    min-width: 0;
  }
`

export default function Clube() {
  const { id = '' } = useParams()
  const [dados, setDados] = useState<DadosClube | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    void carregarClube(id).then((d) => {
      if (!ativo) return
      setDados(d)
      setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [id])

  if (carregando) {
    return (
      <>
        <Navegacao />
        <Pagina>
          <Carregando linhas={3} rotulo="Carregando time…" />
        </Pagina>
      </>
    )
  }

  if (dados === null) {
    return (
      <>
        <Navegacao />
        <Pagina>
          <Vazio
            icone={<Shield size={26} />}
            titulo="Time não encontrado"
            descricao="Este time guardado não existe."
            acao={
              <BotaoLink to="/teams" $variante="primario">
                Meus times
              </BotaoLink>
            }
          />
        </Pagina>
      </>
    )
  }

  const {
    clube,
    membros,
    participacoes,
    campanha,
    artilharia,
    partidas,
    jogadores: jogadoresDoClube,
  } = dados
  const disputadas = partidas.filter((p) => p.linha.status === 'FINISHED')
  const artilheiro = artilharia[0]

  return (
    <>
      <Navegacao />
      <Pagina>
        <Painel>
          <Topo>
            <Escudo $cor={clube.cor_primaria} aria-hidden="true">
              {clube.logo_url !== null && clube.logo_url !== '' ? (
                <img src={clube.logo_url} alt="" />
              ) : (
                <Shield size={36} />
              )}
            </Escudo>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Rotulo style={{ color: 'rgba(255,255,255,.65)' }}>Time</Rotulo>
              <h1>{clube.nome}</h1>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Badge $tom="claro">
                  {participacoes.length} {participacoes.length === 1 ? 'campeonato' : 'campeonatos'}
                </Badge>
                <Badge $tom="claro">
                  {membros.map((j) => j.nome).join(' · ') || 'sem dupla definida'}
                </Badge>
              </div>
              {clube.descricao !== null && clube.descricao !== '' && (
                <Texto $claro $pequeno style={{ marginTop: 12 }}>
                  {clube.descricao}
                </Texto>
              )}
            </div>
          </Topo>
        </Painel>

        <Bloco>
          <TituloSecao>
            <h2>Campanha somada</h2>
          </TituloSecao>
          {campanha.j === 0 ? (
            <Vazio
              titulo="Nenhuma partida disputada"
              descricao="Assim que este time entrar em campo, os números aparecem aqui."
            />
          ) : (
            <>
              <GradeDeNumeros>
                <Numero valor={campanha.pts} rotulo="pontos" destaque />
                <Numero valor={campanha.j} rotulo="jogos" />
                <Numero valor={campanha.v} rotulo="vitórias" />
                <Numero valor={campanha.e} rotulo="empates" />
                <Numero valor={campanha.d} rotulo="derrotas" />
                <Numero valor={campanha.goals} rotulo="gols" />
                <Numero valor={campanha.keeperGoals} rotulo="de goleiro" />
                <Numero valor={campanha.ownGoals} rotulo="contra" />
                <Numero valor={campanha.gf} rotulo="GF" />
                <Numero valor={campanha.gc} rotulo="GC" />
                <Numero
                  valor={`${campanha.saldo > 0 ? '+' : ''}${campanha.saldo}`}
                  rotulo="saldo"
                />
              </GradeDeNumeros>
              <Texto $pequeno $mudo>
                Soma de todos os campeonatos disputados. GF e GC são o valor do placar, em que o gol
                de goleiro vale 2; &quot;gols&quot; é a quantidade de bolas.
              </Texto>
            </>
          )}
        </Bloco>

        {artilheiro !== undefined && (
          <Bloco>
            <TituloSecao>
              <h2>
                <Trophy size={20} aria-hidden="true" />
                Maior artilheiro do time
              </h2>
            </TituloSecao>
            <Cartao>
              <Linha>
                <Avatar nome={artilheiro.playerName} tamanho="sm" />
                <span>
                  <strong>{artilheiro.playerName}</strong>
                  {artilheiro.unresolvedTie && (
                    <>
                      {' '}
                      <Badge $tom="aviso">empate sem critério</Badge>
                    </>
                  )}
                </span>
                <strong>{artilheiro.artilhariaLiquida}</strong>
              </Linha>
            </Cartao>
          </Bloco>
        )}

        <Bloco>
          <TituloSecao>
            <h2>Artilharia do time</h2>
          </TituloSecao>
          <Artilharia linhas={artilharia} jogadores={jogadoresDoClube} />
        </Bloco>

        <Bloco>
          <TituloSecao>
            <h2>Campeonatos</h2>
            <Badge $tom="marca">{participacoes.length}</Badge>
          </TituloSecao>
          {participacoes.length === 0 ? (
            <Vazio
              titulo="Ainda não jogou nenhum"
              descricao="Escolha este time ao montar as equipes do próximo torneio."
            />
          ) : (
            <Cartao $compacto>
              {participacoes.map((p) => (
                <Linha key={p.equipe.id}>
                  <span>
                    <Link to={`/tournaments/${p.torneio.id}`}>{p.torneio.nome}</Link>
                  </span>
                  <Link to={`/teams/${p.equipe.id}`}>ver campanha</Link>
                </Linha>
              ))}
            </Cartao>
          )}
        </Bloco>

        <Bloco>
          <TituloSecao>
            <h2>Histórico</h2>
            <Badge $tom="marca">{disputadas.length}</Badge>
          </TituloSecao>
          {disputadas.length === 0 ? (
            <Vazio titulo="Nenhuma partida disputada" />
          ) : (
            <Cartao $compacto>
              {disputadas.map((p) => (
                <Linha key={p.linha.id}>
                  <span>
                    <Link to={`/matches/${p.linha.id}`}>
                      {clube.nome} × {p.nomeAdversario}
                    </Link>
                    <br />
                    <Texto $pequeno $mudo as="small">
                      {p.torneio}
                    </Texto>
                  </span>
                  <strong>
                    {p.placarClube} × {p.placarAdversario}
                  </strong>
                </Linha>
              ))}
            </Cartao>
          )}
        </Bloco>
      </Pagina>
    </>
  )
}
