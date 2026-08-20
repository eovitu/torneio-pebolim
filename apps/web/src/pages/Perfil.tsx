/**
 * Perfil da própria pessoa.
 *
 * Parece perfil de jogador, não formulário administrativo (§11 do redesign):
 * primeiro quem você é e o que você fez em campo; depois, num bloco discreto,
 * os dados da conta e a troca de senha — que é só mais um bloco do perfil, e
 * não uma seção "Segurança" assustadora à parte.
 *
 * Tudo aqui é do próprio usuário: `profiles` só deixa editar a própria linha, e
 * o avatar vai para uma pasta cujo nome é o id de quem está logado — a policy
 * do Storage não deixa escrever na pasta de outro.
 *
 * Nome e foto aparecem publicamente através de `players`, que é a tabela de
 * leitura pública. Quem copia um para o outro é um gatilho no banco, e não esta
 * tela: assim quem nunca abriu o perfil também aparece certo na artilharia — foi
 * exatamente o que faltou no primeiro uso.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import styled from 'styled-components'
import { Camera, KeyRound, LogOut, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { useAuth } from '../auth/useAuth'
import { traduzirErroAuth } from '../auth/erros'
import { useJogadorPublico, useMeuJogador } from '../dados/hooks'
import { descreverErro } from '../dados/campeonato'
import { Navegacao } from '../components/Navegacao'
import { GradeDeNumeros, Numero } from '../components/Cartoes'
import { Bloco, Cartao, Pagina, Painel, Rotulo, Texto, TituloSecao } from '../ui/Superficie'
import { Acoes, Botao, BotaoLink } from '../ui/Botao'
import { Erro, Sucesso } from '../ui/Estados'
import { Avatar, Badge } from '../ui/Etiqueta'
import { Campo, Entrada, Formulario } from '../components/Formulario'

/** Limite do bucket `avatars`; a checagem daqui é só para avisar antes de subir. */
const TAMANHO_MAXIMO = 2 * 1024 * 1024
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

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

const TrocarFoto = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  min-height: 38px;
  padding: 0 ${({ theme }) => theme.space[3]};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: rgba(255, 255, 255, 0.14);
  border: 2px solid rgba(255, 255, 255, 0.28);
  color: ${({ theme }) => theme.color.onDark};
  font-size: ${({ theme }) => theme.fontSize.caption};
  font-weight: 700;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.24);
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

export default function Perfil() {
  const { user, session, carregando: carregandoSessao, sair } = useAuth()
  const { jogador } = useMeuJogador()
  const { perfil: publico } = useJogadorPublico(jogador?.id ?? null)

  const [perfil, setPerfil] = useState<Tables<'profiles'> | null>(null)
  const [nome, setNome] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaRepetida, setSenhaRepetida] = useState('')

  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const arquivoRef = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    if (user === null) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    if (error !== null) {
      setErro(descreverErro(error))
      return
    }
    if (data !== null) {
      setPerfil(data)
      setNome(data.nome)
      setNascimento(data.data_nascimento ?? '')
    }
  }, [user])

  useEffect(() => {
    void carregar()
  }, [carregar])

  if (!carregandoSessao && session === null) return <Navigate to="/login" replace />

  const salvarDados = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (user === null) return
    setErro(null)
    setAviso(null)
    setOcupado(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        nome: nome.trim(),
        // Campo opcional: string vazia vira ausência de data, não data inválida.
        data_nascimento: nascimento === '' ? null : nascimento,
      })
      .eq('id', user.id)

    setOcupado(false)
    if (error !== null) setErro(descreverErro(error))
    else {
      setAviso('Dados atualizados.')
      await carregar()
    }
  }

  const trocarSenha = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErro(null)
    setAviso(null)
    if (senha.length < 6) {
      setErro('A senha precisa ter ao menos 6 caracteres.')
      return
    }
    if (senha !== senhaRepetida) {
      setErro('As senhas não conferem.')
      return
    }
    setOcupado(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setOcupado(false)
    if (error !== null) setErro(traduzirErroAuth(error))
    else {
      setSenha('')
      setSenhaRepetida('')
      setAviso('Senha alterada.')
    }
  }

  const enviarFoto = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = ev.target.files?.[0]
    if (arquivo === undefined || user === null) return
    setErro(null)
    setAviso(null)

    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      setErro('Use uma imagem JPEG, PNG, WebP ou AVIF.')
      return
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      setErro('A imagem precisa ter no máximo 2 MB.')
      return
    }

    setOcupado(true)
    // A pasta é o id do usuário — é isso que a policy do Storage verifica.
    const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const caminho = `${user.id}/avatar.${extensao}`

    const { error: erroUpload } = await supabase.storage
      .from('avatars')
      .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type })

    if (erroUpload !== null) {
      setOcupado(false)
      setErro(descreverErro(erroUpload))
      return
    }

    const { data: publicoUrl } = supabase.storage.from('avatars').getPublicUrl(caminho)
    // A query no fim força o navegador a buscar de novo depois da troca.
    const url = `${publicoUrl.publicUrl}?v=${Date.now()}`

    const { error: erroPerfil } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', user.id)

    setOcupado(false)
    if (erroPerfil !== null) setErro(descreverErro(erroPerfil))
    else {
      setAviso('Foto atualizada.')
      await carregar()
    }
    if (arquivoRef.current !== null) arquivoRef.current.value = ''
  }

  const s = publico?.estatisticas

  return (
    <>
      <Navegacao />
      <Pagina>
        <Painel>
          <Cabecalho>
            <Avatar nome={perfil?.nome ?? '?'} url={perfil?.avatar_url} tamanho="xl" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Rotulo style={{ color: 'rgba(255,255,255,.65)' }}>Seu perfil</Rotulo>
              <h1>{perfil?.nome ?? 'Carregando…'}</h1>
              <Texto $claro $pequeno style={{ marginTop: 4 }}>
                {user?.email}
              </Texto>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <TrocarFoto>
                  <Camera size={15} aria-hidden="true" />
                  Trocar foto
                  <input
                    ref={arquivoRef}
                    type="file"
                    accept={TIPOS_ACEITOS.join(',')}
                    disabled={ocupado}
                    onChange={(e) => void enviarFoto(e)}
                  />
                </TrocarFoto>
                {jogador !== null && (
                  <BotaoLink to={`/players/${jogador.id}`} $variante="claro" $tamanho="sm">
                    <UserRound size={15} aria-hidden="true" />
                    Ver perfil público
                  </BotaoLink>
                )}
              </div>
            </div>
          </Cabecalho>
        </Painel>

        {erro !== null && <Erro>{erro}</Erro>}
        {aviso !== null && <Sucesso>{aviso}</Sucesso>}

        {s !== undefined && (
          <Bloco>
            <TituloSecao>
              <h2>Sua campanha</h2>
              {publico !== null && publico.times.length > 0 && (
                <Badge $tom="marca">
                  {publico.times.length === 1 ? '1 time' : `${publico.times.length} times`}
                </Badge>
              )}
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
          </Bloco>
        )}

        <Bloco>
          <TituloSecao>
            <h2>Seus dados</h2>
          </TituloSecao>
          <Cartao>
            <Formulario onSubmit={(e) => void salvarDados(e)}>
              <Campo>
                Nome de exibição
                <Entrada value={nome} onChange={(e) => setNome(e.target.value)} minLength={2} />
              </Campo>
              <Campo>
                Data de nascimento (opcional)
                <Entrada
                  type="date"
                  value={nascimento}
                  onChange={(e) => setNascimento(e.target.value)}
                />
              </Campo>
              <Botao type="submit" disabled={ocupado}>
                {ocupado ? 'Salvando…' : 'Salvar dados'}
              </Botao>
            </Formulario>
          </Cartao>
        </Bloco>

        <Bloco>
          <TituloSecao>
            <h2>
              <KeyRound size={20} aria-hidden="true" />
              Sua senha
            </h2>
          </TituloSecao>
          <Cartao>
            <Texto $pequeno $mudo style={{ marginBottom: 16 }}>
              Se você entrou com a senha padrão distribuída pelo organizador, troque agora por uma
              só sua.
            </Texto>
            <Formulario onSubmit={(e) => void trocarSenha(e)}>
              <Campo>
                Nova senha
                <Entrada
                  type="password"
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </Campo>
              <Campo>
                Repita a nova senha
                <Entrada
                  type="password"
                  autoComplete="new-password"
                  value={senhaRepetida}
                  onChange={(e) => setSenhaRepetida(e.target.value)}
                />
              </Campo>
              <Botao type="submit" $variante="contorno" disabled={ocupado}>
                Trocar senha
              </Botao>
            </Formulario>
          </Cartao>
        </Bloco>

        <Acoes>
          <BotaoLink to="/rules" $variante="fantasma">
            Ver regras oficiais
          </BotaoLink>
          <Botao type="button" $variante="contorno" onClick={() => void sair()}>
            <LogOut size={16} aria-hidden="true" />
            Sair da conta
          </Botao>
        </Acoes>
      </Pagina>
    </>
  )
}
