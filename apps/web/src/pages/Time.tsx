/**
 * Página de um time: identidade, elenco, campanha, partidas e artilheiros.
 *
 * Personalização (nome, descrição, cor, logo) aparece só para quem tem
 * permissão de alterar. Hoje `teams_update_admin` restringe a escrita ao
 * administrador — é a permissão que já existe no sistema, e não inventamos
 * uma nova aqui. Para o jogador, a tela diz claramente com quem falar.
 */

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import styled from 'styled-components'
import { Camera, Palette, Users } from 'lucide-react'
import { Navegacao } from '../components/Navegacao'
import { CartaoDePartida, GradeDeNumeros, LinhaDeJogador, Numero } from '../components/Cartoes'
import { Artilharia } from '../components/Tabelas'
import { useCampeonato, useMeuJogador } from '../dados/hooks'
import { ROTULO_STATUS_TORNEIO, descreverErro } from '../dados/campeonato'
import type { LinhaEquipe } from '../dados/campeonato'
import { supabase } from '../lib/supabase'
import { usePapeis } from '../auth/usePapeis'
import { useAuth } from '../auth/useAuth'
import { Bloco, Cartao, Pagina, Painel, Rotulo, Texto, TituloSecao } from '../ui/Superficie'
import { Acoes, Botao, BotaoLink } from '../ui/Botao'
import { Carregando, Erro, Sucesso, Vazio } from '../ui/Estados'
import { Badge } from '../ui/Etiqueta'
import { AreaTexto, Campo, Entrada, Formulario } from '../components/Formulario'
import { midia } from '../design-system/tokens'

const TopoTime = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space[5]};

  h1 {
    font-size: ${({ theme }) => theme.fontSize.h2};
    overflow-wrap: anywhere;
  }
`

const EscudoGrande = styled.div<{ $cor?: string | null }>`
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

/** Rótulo com cara de botão: `<input type="file">` nativo não se estiliza. */
const TrocarEscudo = styled.label`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[2]};
  min-height: ${({ theme }) => theme.layout.toque};
  padding: 0 ${({ theme }) => theme.space[5]};
  border-radius: ${({ theme }) => theme.radius.sm};
  border: 2px solid ${({ theme }) => theme.color.border};
  background: ${({ theme }) => theme.color.surface};
  color: ${({ theme }) => theme.color.text};
  font-size: ${({ theme }) => theme.fontSize.small};
  font-weight: 700;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.color.marcaClara};
    background: ${({ theme }) => theme.color.campo[50]};
  }

  input {
    /* Escondido visualmente, mas ainda alcançável pelo teclado. */
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
`

const Lista = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[3]};

  ${midia.md} {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
`

export default function Time() {
  const { id = '' } = useParams()
  const { ehAdmin } = usePapeis()
  const { user } = useAuth()
  const { jogador } = useMeuJogador()

  const [equipe, setEquipe] = useState<LinhaEquipe | null>(null)
  const [buscandoEquipe, setBuscandoEquipe] = useState(true)

  useEffect(() => {
    let ativo = true
    setBuscandoEquipe(true)
    void supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!ativo) return
        setEquipe(data)
        setBuscandoEquipe(false)
      })
    return () => {
      ativo = false
    }
  }, [id])

  const { campeonato, carregando, recarregar } = useCampeonato(equipe?.tournament_id ?? null)

  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cor, setCor] = useState('#146345')
  const [ocupado, setOcupado] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  // Abrir o formulário sempre parte dos valores atuais do time.
  const abrirEdicao = (e: LinhaEquipe) => {
    setNome(e.nome)
    setDescricao(e.descricao ?? '')
    setCor(e.cor_primaria ?? '#146345')
    setEditando(true)
  }

  const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  const TAMANHO_MAXIMO = 2 * 1024 * 1024

  /**
   * Envia o escudo do time.
   *
   * O arquivo vai para `avatars/<id do usuário>/time-<id do time>.<ext>`. A
   * policy do Storage já amarra a escrita à pasta de quem está logado, e o
   * bucket já é de leitura pública — não é preciso bucket nem policy nova.
   */
  const enviarEscudo = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = ev.target.files?.[0]
    if (arquivo === undefined || user === null || equipe === null) return
    setErroAcao(null)
    setAviso(null)

    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      setErroAcao('Use uma imagem JPEG, PNG, WebP ou AVIF.')
      return
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      setErroAcao('A imagem precisa ter no máximo 2 MB.')
      return
    }

    setOcupado(true)
    const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const caminho = `${user.id}/time-${equipe.id}.${extensao}`

    const { error: erroUpload } = await supabase.storage
      .from('avatars')
      .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type })

    if (erroUpload !== null) {
      setOcupado(false)
      setErroAcao(descreverErro(erroUpload))
      return
    }

    const { data: publico } = supabase.storage.from('avatars').getPublicUrl(caminho)
    // A query no fim força o navegador a buscar de novo depois da troca.
    const url = `${publico.publicUrl}?v=${Date.now()}`

    const { error } = await supabase.from('teams').update({ logo_url: url }).eq('id', equipe.id)
    setOcupado(false)
    if (error !== null) {
      setErroAcao(descreverErro(error))
      return
    }
    setAviso('Escudo atualizado.')
    const { data } = await supabase.from('teams').select('*').eq('id', equipe.id).maybeSingle()
    setEquipe(data)
    await recarregar()
    if (arquivoRef.current !== null) arquivoRef.current.value = ''
  }

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (equipe === null) return
    setErroAcao(null)
    setAviso(null)
    setOcupado(true)
    const { error } = await supabase
      .from('teams')
      .update({
        nome: nome.trim(),
        descricao: descricao.trim() === '' ? null : descricao.trim(),
        cor_primaria: cor,
      })
      .eq('id', equipe.id)
    setOcupado(false)
    if (error !== null) {
      setErroAcao(descreverErro(error))
      return
    }
    setAviso('Time atualizado.')
    setEditando(false)
    const { data } = await supabase.from('teams').select('*').eq('id', equipe.id).maybeSingle()
    setEquipe(data)
    await recarregar()
  }

  if (buscandoEquipe || (equipe !== null && carregando)) {
    return (
      <>
        <Navegacao />
        <Pagina>
          <Carregando linhas={3} rotulo="Carregando time…" />
        </Pagina>
      </>
    )
  }

  if (equipe === null || campeonato === null) {
    return (
      <>
        <Navegacao />
        <Pagina>
          <Vazio
            icone={<Users size={26} />}
            titulo="Time não encontrado"
            descricao="Esta equipe não existe ou pertence a um torneio que não está público."
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

  const stats = campeonato.estatisticasDeEquipe.get(equipe.id)
  // Espelha a policy `teams_update_admin_ou_integrante`. Esconder o botão é
  // conveniência: quem barra de fato é a RLS e o grant por coluna (§45).
  const souDoElenco =
    jogador !== null && campeonato.elencos.some((l) => l.team_id === equipe.id && l.player_id === jogador.id)
  const podePersonalizar = ehAdmin || souDoElenco
  const elenco = campeonato.elencos
    .filter((l) => l.team_id === equipe.id)
    .flatMap((l) => {
      const j = campeonato.jogadores.find((x) => x.id === l.player_id)
      return j === undefined ? [] : [j]
    })
  const idsElenco = new Set(elenco.map((j) => j.id))
  const partidas = campeonato.partidas.filter(
    (p) => p.linha.team_a_id === equipe.id || p.linha.team_b_id === equipe.id,
  )
  const artilheiros = campeonato.artilharia.filter((a) => idsElenco.has(a.playerId))

  return (
    <>
      <Navegacao />
      <Pagina>
        <Painel>
          <TopoTime>
            <EscudoGrande $cor={equipe.cor_primaria} aria-hidden="true">
              {equipe.logo_url !== null && equipe.logo_url !== '' ? (
                <img src={equipe.logo_url} alt="" />
              ) : (
                <Users size={36} />
              )}
            </EscudoGrande>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Rotulo style={{ color: 'rgba(255,255,255,.65)' }}>Equipe</Rotulo>
              <h1>{equipe.nome}</h1>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Badge $tom="claro">{campeonato.torneio.nome}</Badge>
                <Badge $tom="claro">{ROTULO_STATUS_TORNEIO[campeonato.torneio.status]}</Badge>
              </div>
              {equipe.descricao !== null && equipe.descricao !== '' && (
                <Texto $claro $pequeno style={{ marginTop: 12 }}>
                  {equipe.descricao}
                </Texto>
              )}
            </div>
          </TopoTime>
        </Painel>

        {erroAcao !== null && <Erro>{erroAcao}</Erro>}
        {aviso !== null && <Sucesso>{aviso}</Sucesso>}

        {stats !== undefined && (
          <Bloco>
            <TituloSecao>
              <h2>Campanha</h2>
            </TituloSecao>
            <GradeDeNumeros>
              <Numero valor={stats.pts} rotulo="pontos" destaque />
              <Numero valor={stats.j} rotulo="jogos" />
              <Numero valor={stats.v} rotulo="vitórias" />
              <Numero valor={stats.e} rotulo="empates" />
              <Numero valor={stats.d} rotulo="derrotas" />
              <Numero valor={stats.goals} rotulo="gols" />
              <Numero valor={stats.keeperGoals} rotulo="de goleiro" />
              <Numero valor={stats.ownGoals} rotulo="contra" />
              <Numero valor={stats.gf} rotulo="GF" />
              <Numero valor={stats.gc} rotulo="GC" />
              <Numero valor={`${stats.saldo > 0 ? '+' : ''}${stats.saldo}`} rotulo="saldo" />
            </GradeDeNumeros>
            <Texto $pequeno $mudo>
              GF e GC são o valor do placar, em que o gol de goleiro vale 2. &quot;Gols&quot; é a
              quantidade de bolas — os dois números não se misturam.
            </Texto>
          </Bloco>
        )}

        <Bloco>
          <TituloSecao>
            <h2>Elenco</h2>
            <Badge $tom="marca">{elenco.length}</Badge>
          </TituloSecao>
          {elenco.length === 0 ? (
            <Vazio titulo="Elenco vazio" descricao="Nenhum jogador foi vinculado a esta equipe." />
          ) : (
            <Cartao $compacto>
              {elenco.map((j) => {
                const s = campeonato.estatisticasDeJogador.get(j.id)
                return (
                  <LinhaDeJogador
                    key={j.id}
                    jogador={j}
                    detalhe={s === undefined ? undefined : `${s.j} jogos`}
                    direita={
                      s === undefined ? undefined : (
                        <Badge $tom="acento">{s.artilhariaLiquida} art.</Badge>
                      )
                    }
                  />
                )
              })}
            </Cartao>
          )}
        </Bloco>

        <Bloco>
          <TituloSecao>
            <h2>Partidas</h2>
          </TituloSecao>
          {partidas.length === 0 ? (
            <Vazio titulo="Nenhuma partida deste time ainda" />
          ) : (
            <Lista>
              {partidas.map((p) => (
                <CartaoDePartida
                  key={p.linha.id}
                  partida={p.linha}
                  nomeA={p.nomeA}
                  nomeB={p.nomeB}
                  placarA={p.placarA}
                  placarB={p.placarB}
                />
              ))}
            </Lista>
          )}
        </Bloco>

        {artilheiros.length > 0 && (
          <Bloco>
            <TituloSecao>
              <h2>Artilheiros do time</h2>
            </TituloSecao>
            <Artilharia linhas={artilheiros} jogadores={campeonato.jogadores} />
          </Bloco>
        )}

        <Bloco>
          <TituloSecao>
            <h2>
              <Palette size={20} aria-hidden="true" />
              Personalização
            </h2>
          </TituloSecao>

          {!podePersonalizar ? (
            <Texto $pequeno $mudo>
              A identidade da equipe é definida por quem joga nela e pelo organizador do
              campeonato.
            </Texto>
          ) : editando ? (
            <Cartao>
              <Formulario onSubmit={(e) => void salvar(e)}>
                <Campo>
                  Nome do time
                  <Entrada value={nome} onChange={(e) => setNome(e.target.value)} minLength={1} />
                </Campo>
                <Campo>
                  Descrição
                  <AreaTexto
                    value={descricao}
                    placeholder="Uma frase que define a equipe."
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </Campo>
                <Campo>
                  Cor principal
                  <Entrada
                    type="color"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    style={{ padding: 6, maxWidth: 120 }}
                  />
                </Campo>
                <Acoes>
                  <Botao type="submit" disabled={ocupado}>
                    {ocupado ? 'Salvando…' : 'Salvar time'}
                  </Botao>
                  <Botao type="button" $variante="contorno" onClick={() => setEditando(false)}>
                    Cancelar
                  </Botao>
                </Acoes>
              </Formulario>
            </Cartao>
          ) : (
            <Acoes>
              <Botao type="button" $variante="contorno" onClick={() => abrirEdicao(equipe)}>
                <Palette size={16} aria-hidden="true" />
                Personalizar time
              </Botao>
              <TrocarEscudo>
                <Camera size={16} aria-hidden="true" />
                {ocupado ? 'Enviando…' : 'Trocar escudo'}
                <input
                  ref={arquivoRef}
                  type="file"
                  accept={TIPOS_ACEITOS.join(',')}
                  disabled={ocupado}
                  onChange={(e) => void enviarEscudo(e)}
                />
              </TrocarEscudo>
            </Acoes>
          )}
        </Bloco>
      </Pagina>
    </>
  )
}
