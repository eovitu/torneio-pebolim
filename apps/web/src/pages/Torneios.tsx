/**
 * Lista pública de torneios.
 *
 * Cada cartão leva à página completa daquele campeonato. Quem está logado e
 * ainda não se inscreveu vê o botão "Entrar no torneio" já aqui, enquanto as
 * inscrições estiverem abertas.
 *
 * Inscrição é decisão do proprietário (20/08/2026): autoinscrição direta, sem
 * aprovação, e SOMENTE enquanto o torneio está em configuração. Quem valida
 * isso de verdade é a RPC `inscrever_se_no_torneio` no servidor — o botão só
 * reflete a regra (§45).
 */

import { useState } from 'react'
import styled from 'styled-components'
import { Check, LogIn, Trophy } from 'lucide-react'
import { Navegacao } from '../components/Navegacao'
import { CartaoDeTorneio } from '../components/Cartoes'
import { useMeuJogador, useTorneios } from '../dados/hooks'
import { descreverErro } from '../dados/campeonato'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { Bloco, Grade, Pagina, Rotulo, Texto, TituloSecao } from '../ui/Superficie'
import { Acoes, Botao, BotaoLink } from '../ui/Botao'
import { Carregando, Erro, Sucesso, Vazio } from '../ui/Estados'
import { Badge } from '../ui/Etiqueta'

const Inscrito = styled.p`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[2]};
  margin: 0;
  min-height: ${({ theme }) => theme.layout.toque};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.sucessoSuave};
  color: ${({ theme }) => theme.color.sucesso};
  font-size: ${({ theme }) => theme.fontSize.small};
  font-weight: 700;
`

export default function Torneios() {
  const { session } = useAuth()
  const { itens, carregando, erro, recarregar } = useTorneios()
  const { jogador, recarregar: recarregarJogador } = useMeuJogador()

  const [inscritoEm, setInscritoEm] = useState<Record<string, boolean>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const inscrever = async (tournamentId: string, nome: string) => {
    setErroAcao(null)
    setAviso(null)
    setOcupado(tournamentId)
    const { error } = await supabase.rpc('inscrever_se_no_torneio', {
      p_tournament_id: tournamentId,
    })
    setOcupado(null)
    if (error !== null) {
      setErroAcao(descreverErro(error))
      return
    }
    setInscritoEm((atual) => ({ ...atual, [tournamentId]: true }))
    setAviso(`Você entrou em ${nome}. Boa sorte!`)
    await Promise.all([recarregar(), recarregarJogador()])
  }

  return (
    <>
      <Navegacao />
      <Pagina>
        <Bloco>
          <TituloSecao>
            <div>
              <Rotulo $cor="acento">Campeonatos</Rotulo>
              <h1>Torneios</h1>
            </div>
            {itens.length > 0 && <Badge $tom="marca">{itens.length}</Badge>}
          </TituloSecao>
          <Texto $mudo>
            Todos os campeonatos públicos. Entre em um torneio aberto para disputar, ou abra
            qualquer um para acompanhar tabela, partidas e artilharia.
          </Texto>
        </Bloco>

        {erro !== null && <Erro>{erro}</Erro>}
        {erroAcao !== null && <Erro>{erroAcao}</Erro>}
        {aviso !== null && <Sucesso>{aviso}</Sucesso>}

        {carregando ? (
          <Carregando linhas={3} rotulo="Carregando torneios…" />
        ) : itens.length === 0 ? (
          <Vazio
            icone={<Trophy size={26} />}
            titulo="Nenhum torneio por aqui"
            descricao="Assim que o organizador criar um campeonato, ele aparece nesta lista."
            acao={
              <BotaoLink to="/home" $variante="contorno">
                Voltar ao início
              </BotaoLink>
            }
          />
        ) : (
          <Grade $min="300px">
            {itens.map(({ torneio, equipes, participantes, idsParticipantes, aoVivo }) => {
              const abertas = torneio.status === 'CONFIGURACAO'
              const jaEstou =
                inscritoEm[torneio.id] === true ||
                (jogador !== null && idsParticipantes.includes(jogador.id))

              return (
                <CartaoDeTorneio
                  key={torneio.id}
                  torneio={torneio}
                  equipes={equipes}
                  participantes={participantes}
                  aoVivo={aoVivo}
                  acao={
                    <Acoes>
                      <BotaoLink
                        to={`/tournaments/${torneio.id}`}
                        $variante={abertas ? 'contorno' : 'primario'}
                        $bloco
                      >
                        Ver torneio
                      </BotaoLink>

                      {abertas &&
                        (jaEstou ? (
                          <Inscrito>
                            <Check size={16} aria-hidden="true" />
                            Você está inscrito
                          </Inscrito>
                        ) : session === null ? (
                          <BotaoLink to="/login" $variante="primario" $bloco>
                            <LogIn size={16} aria-hidden="true" />
                            Entrar para participar
                          </BotaoLink>
                        ) : (
                          <Botao
                            type="button"
                            $variante="primario"
                            $bloco
                            disabled={ocupado === torneio.id}
                            onClick={() => void inscrever(torneio.id, torneio.nome)}
                          >
                            {ocupado === torneio.id ? 'Inscrevendo…' : 'Entrar no torneio'}
                          </Botao>
                        ))}
                    </Acoes>
                  }
                />
              )
            })}
          </Grade>
        )}
      </Pagina>
    </>
  )
}
