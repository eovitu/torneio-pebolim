/**
 * Times em que a pessoa joga.
 *
 * Lista curta e direta: cada cartão mostra o time, o torneio e a campanha.
 * Quem não joga em nenhum ainda vê uma saída — explorar torneios — em vez de
 * uma tela vazia sem explicação (§20 do redesign).
 */

import { Users } from 'lucide-react'
import { Navegacao } from '../components/Navegacao'
import { CartaoDeTime } from '../components/Cartoes'
import { useMeusTimes } from '../dados/hooks'
import { useAuth } from '../auth/useAuth'
import { Bloco, Grade, Pagina, Rotulo, Texto, TituloSecao } from '../ui/Superficie'
import { BotaoLink } from '../ui/Botao'
import { Carregando, Vazio } from '../ui/Estados'
import { ROTULO_STATUS_TORNEIO } from '../dados/campeonato'

export default function Times() {
  const { session } = useAuth()
  const { times, carregando } = useMeusTimes()

  return (
    <>
      <Navegacao />
      <Pagina>
        <Bloco>
          <Rotulo $cor="acento">Suas equipes</Rotulo>
          <h1>Times</h1>
          <Texto $mudo>
            Todos os times em que você joga, com o torneio de cada um. Abra um time para ver elenco,
            campanha e artilheiros.
          </Texto>
        </Bloco>

        {session === null ? (
          <Vazio
            icone={<Users size={26} />}
            titulo="Entre para ver seus times"
            descricao="Seus times aparecem aqui depois que você entra em um torneio e as equipes são sorteadas."
            acao={
              <BotaoLink to="/login" $variante="primario">
                Entrar
              </BotaoLink>
            }
          />
        ) : carregando ? (
          <Carregando linhas={2} rotulo="Carregando seus times…" />
        ) : times.length === 0 ? (
          <Vazio
            icone={<Users size={26} />}
            titulo="Você ainda não está em nenhum time"
            descricao="Entre em um torneio aberto: quando o organizador sortear as duplas, seu time aparece aqui."
            acao={
              <BotaoLink to="/tournaments" $variante="primario">
                Explorar torneios
              </BotaoLink>
            }
          />
        ) : (
          <Grade $min="320px">
            {times.map(({ equipe, torneio, companheiros }) => (
              <CartaoDeTime
                key={equipe.id}
                equipe={equipe}
                integrantes={companheiros}
                legenda={`${torneio.nome} · ${ROTULO_STATUS_TORNEIO[torneio.status]}`}
                para={`/teams/${equipe.id}`}
              />
            ))}
          </Grade>
        )}

        <TituloSecao>
          <Texto $pequeno $mudo>
            Procurando um time de outro campeonato? Abra o torneio e veja todas as equipes dele.
          </Texto>
          <BotaoLink to="/tournaments" $variante="contorno" $tamanho="sm">
            Ver torneios
          </BotaoLink>
        </TituloSecao>
      </Pagina>
    </>
  )
}
