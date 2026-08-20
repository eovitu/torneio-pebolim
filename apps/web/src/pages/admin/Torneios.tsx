/**
 * Administração de torneios: histórico, criação e acesso à condução.
 *
 * A criação virou um passo a passo curto — nome, formato, confirmação — em vez
 * de uma tela única com quatro campos técnicos (§14 do redesign). O slug é
 * derivado do nome; ninguém deveria precisar entender o que é um slug para
 * criar um campeonato, mas ele continua editável para quem quiser.
 *
 * O torneio nasce em CONFIGURACAO. Quantas equipes e quantos jogadores por
 * equipe são configuráveis e podem ser ajustados depois — o 4×2 é só o padrão
 * do primeiro campeonato, nunca uma regra fixa (§13 do CLAUDE.md).
 */

import { useMemo, useState } from 'react'
import styled from 'styled-components'
import { ArrowLeft, ArrowRight, Plus, Trophy } from 'lucide-react'
import { RULES_VERSION } from '@pebolim/domain'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/useAuth'
import { useTorneios } from '../../dados/hooks'
import { ROTULO_STATUS_TORNEIO, descreverErro } from '../../dados/campeonato'
import { Navegacao } from '../../components/Navegacao'
import { CartaoDeTorneio } from '../../components/Cartoes'
import { Bloco, Grade, Pagina, Rotulo, Texto, TituloSecao } from '../../ui/Superficie'
import { Acoes, Botao, BotaoLink } from '../../ui/Botao'
import { Carregando, Erro, Sucesso, Vazio } from '../../ui/Estados'
import { Modal } from '../../ui/Modal'
import { Campo, Entrada } from '../../components/Formulario'
import { Badge } from '../../ui/Etiqueta'

/** Nome legível → identificador de URL. */
function paraSlug(nome: string): string {
  return nome
    .normalize('NFD')
    // Remove os acentos que o NFD separou das letras.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

const Passos = styled.ol`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  list-style: none;
  margin: 0 0 ${({ theme }) => theme.space[2]};
  padding: 0;
`

const Passo = styled.li<{ $ativo: boolean; $feito: boolean }>`
  flex: 1;
  height: 5px;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme, $ativo, $feito }) =>
    $ativo || $feito ? theme.color.accent : theme.color.surfaceSunken};
  transition: background ${({ theme }) => theme.motion.normal} ease;
`

const Resumo = styled.dl`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[4]};
  margin: 0;
  padding: ${({ theme }) => theme.space[4]};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surfaceAlt};
  font-size: ${({ theme }) => theme.fontSize.small};

  dt {
    font-weight: 700;
    color: ${({ theme }) => theme.color.muted};
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
`

export default function Torneios() {
  const { user } = useAuth()
  const { itens, carregando, erro, recarregar } = useTorneios()

  const [criando, setCriando] = useState(false)
  const [passo, setPasso] = useState(0)
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [maxEquipes, setMaxEquipes] = useState(4)
  const [porEquipe, setPorEquipe] = useState(2)
  const [ocupado, setOcupado] = useState(false)
  const [erroCriacao, setErroCriacao] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const ativos = useMemo(
    () => itens.filter((i) => i.torneio.status !== 'ENCERRADO'),
    [itens],
  )
  const encerrados = useMemo(
    () => itens.filter((i) => i.torneio.status === 'ENCERRADO'),
    [itens],
  )

  const slugFinal = slugManual ? slug : paraSlug(nome)
  const nomeValido = nome.trim().length >= 2
  const formatoValido = maxEquipes >= 2 && porEquipe >= 1

  const fechar = () => {
    setCriando(false)
    setPasso(0)
    setNome('')
    setSlug('')
    setSlugManual(false)
    setMaxEquipes(4)
    setPorEquipe(2)
    setErroCriacao(null)
  }

  const criar = async () => {
    if (user === null) return
    setErroCriacao(null)
    setOcupado(true)
    const { error } = await supabase.from('tournaments').insert({
      nome: nome.trim(),
      slug: slugFinal,
      max_equipes: maxEquipes,
      jogadores_por_equipe: porEquipe,
      rules_version: RULES_VERSION,
      criado_por: user.id,
    })
    setOcupado(false)
    if (error !== null) {
      setErroCriacao(descreverErro(error))
      return
    }
    setAviso(`Torneio "${nome.trim()}" criado. As inscrições já estão abertas.`)
    fechar()
    await recarregar()
  }

  return (
    <>
      <Navegacao />
      <Pagina>
        <Bloco>
          <TituloSecao>
            <div>
              <Rotulo $cor="acento">Administração</Rotulo>
              <h1>Torneios</h1>
            </div>
            <Botao type="button" onClick={() => setCriando(true)}>
              <Plus size={18} aria-hidden="true" />
              Criar torneio
            </Botao>
          </TituloSecao>
          <Texto $mudo>
            Crie um campeonato, conduza as fases e consulte o histórico dos que já acabaram.
          </Texto>
        </Bloco>

        {erro !== null && <Erro>{erro}</Erro>}
        {aviso !== null && <Sucesso>{aviso}</Sucesso>}

        {carregando ? (
          <Carregando linhas={3} rotulo="Carregando torneios…" />
        ) : itens.length === 0 ? (
          <Vazio
            icone={<Trophy size={26} />}
            titulo="Nenhum torneio criado"
            descricao="Comece criando o primeiro campeonato. Leva menos de um minuto."
            acao={
              <Botao type="button" onClick={() => setCriando(true)}>
                <Plus size={18} aria-hidden="true" />
                Criar torneio
              </Botao>
            }
          />
        ) : (
          <>
            <Bloco>
              <TituloSecao>
                <h2>Em atividade</h2>
                <Badge $tom="marca">{ativos.length}</Badge>
              </TituloSecao>
              {ativos.length === 0 ? (
                <Vazio titulo="Nenhum torneio ativo" descricao="Todos os campeonatos já foram encerrados." />
              ) : (
                <Grade $min="300px">
                  {ativos.map(({ torneio, equipes, participantes, aoVivo }) => (
                    <CartaoDeTorneio
                      key={torneio.id}
                      torneio={torneio}
                      equipes={equipes}
                      participantes={participantes}
                      aoVivo={aoVivo}
                      acao={
                        <BotaoLink to={`/admin/tournaments/${torneio.id}`} $bloco>
                          Conduzir torneio
                        </BotaoLink>
                      }
                    />
                  ))}
                </Grade>
              )}
            </Bloco>

            <Bloco>
              <TituloSecao>
                <h2>Histórico</h2>
                <Badge $tom="neutro">{encerrados.length}</Badge>
              </TituloSecao>
              {encerrados.length === 0 ? (
                <Vazio
                  titulo="Nenhum torneio encerrado"
                  descricao="Campeonatos encerrados ficam guardados aqui, com tabela, partidas e artilharia."
                />
              ) : (
                <Grade $min="300px">
                  {encerrados.map(({ torneio, equipes, participantes }) => (
                    <CartaoDeTorneio
                      key={torneio.id}
                      torneio={torneio}
                      equipes={equipes}
                      participantes={participantes}
                      acao={
                        <Acoes>
                          <BotaoLink to={`/tournaments/${torneio.id}`} $variante="contorno" $bloco>
                            Ver detalhes
                          </BotaoLink>
                          <BotaoLink
                            to={`/admin/tournaments/${torneio.id}`}
                            $variante="fantasma"
                            $bloco
                          >
                            Administrar
                          </BotaoLink>
                        </Acoes>
                      }
                    />
                  ))}
                </Grade>
              )}
            </Bloco>
          </>
        )}
      </Pagina>

      <Modal
        aberto={criando}
        titulo="Criar torneio"
        aoFechar={fechar}
        rodape={
          <Acoes $fim>
            {passo > 0 && (
              <Botao type="button" $variante="contorno" onClick={() => setPasso(passo - 1)}>
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar
              </Botao>
            )}
            {passo < 2 ? (
              <Botao
                type="button"
                disabled={passo === 0 ? !nomeValido : !formatoValido}
                onClick={() => setPasso(passo + 1)}
              >
                Continuar
                <ArrowRight size={16} aria-hidden="true" />
              </Botao>
            ) : (
              <Botao type="button" disabled={ocupado} onClick={() => void criar()}>
                {ocupado ? 'Criando…' : 'Criar torneio'}
              </Botao>
            )}
          </Acoes>
        }
      >
        <Passos aria-label={`Passo ${passo + 1} de 3`}>
          {[0, 1, 2].map((i) => (
            <Passo key={i} $ativo={i === passo} $feito={i < passo} />
          ))}
        </Passos>

        {erroCriacao !== null && <Erro>{erroCriacao}</Erro>}

        {passo === 0 && (
          <>
            <Rotulo $cor="acento">Passo 1 de 3</Rotulo>
            <h3>Como se chama o campeonato?</h3>
            <Campo>
              Nome do torneio
              <Entrada
                value={nome}
                placeholder="Copa do Escritório 2026"
                autoFocus
                onChange={(e) => setNome(e.target.value)}
              />
            </Campo>
            <Campo>
              Endereço na web
              <Entrada
                value={slugFinal}
                onChange={(e) => {
                  setSlugManual(true)
                  setSlug(paraSlug(e.target.value))
                }}
              />
            </Campo>
            <Texto $pequeno $mudo>
              Gerado automaticamente a partir do nome. Só mexa se quiser um endereço diferente.
            </Texto>
          </>
        )}

        {passo === 1 && (
          <>
            <Rotulo $cor="acento">Passo 2 de 3</Rotulo>
            <h3>Qual o formato?</h3>
            <Campo>
              Quantas equipes
              <Entrada
                type="number"
                min={2}
                inputMode="numeric"
                value={maxEquipes}
                onChange={(e) => setMaxEquipes(Number(e.target.value))}
              />
            </Campo>
            <Campo>
              Jogadores por equipe
              <Entrada
                type="number"
                min={1}
                inputMode="numeric"
                value={porEquipe}
                onChange={(e) => setPorEquipe(Number(e.target.value))}
              />
            </Campo>
            <Texto $pequeno $mudo>
              Isto define quantos participantes o sorteio espera ({maxEquipes * porEquipe} pessoas).
              Não é um teto definitivo: dá para ajustar depois, se aparecer mais gente.
            </Texto>
          </>
        )}

        {passo === 2 && (
          <>
            <Rotulo $cor="acento">Passo 3 de 3</Rotulo>
            <h3>Tudo certo?</h3>
            <Resumo>
              <dt>Nome</dt>
              <dd>{nome.trim()}</dd>
              <dt>Endereço</dt>
              <dd>/{slugFinal}</dd>
              <dt>Formato</dt>
              <dd>
                {maxEquipes} equipes de {porEquipe} · {maxEquipes * porEquipe} participantes
              </dd>
              <dt>Regras</dt>
              <dd>versão {RULES_VERSION}</dd>
              <dt>Estado inicial</dt>
              <dd>{ROTULO_STATUS_TORNEIO.CONFIGURACAO}</dd>
            </Resumo>
            <Texto $pequeno $mudo>
              O torneio nasce com as inscrições abertas: as pessoas já podem entrar sozinhas pela
              tela de Torneios. Você monta as equipes quando quiser.
            </Texto>
          </>
        )}
      </Modal>
    </>
  )
}
