/**
 * Perfil do usuário.
 *
 * As contas nascem com uma senha padrão distribuída pelo dono do torneio, então
 * trocar a senha aqui é o primeiro cuidado de segurança que cada um pode tomar
 * por conta própria.
 *
 * Tudo nesta tela é do próprio usuário: `profiles` só deixa editar a própria
 * linha, e o avatar vai para uma pasta cujo nome é o id de quem está logado —
 * a policy do Storage não deixa escrever na pasta de outro.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import styled from 'styled-components'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { useAuth } from '../auth/useAuth'
import { traduzirErroAuth } from '../auth/erros'
import { Card, Kicker, Note, Shell } from '../components/Shell'
import {
  Alerta,
  Aviso,
  Botao,
  Campo,
  Entrada,
  Formulario,
  LinhaAlternativa,
} from '../components/Formulario'

const Foto = styled.img`
  display: block;
  width: 96px;
  height: 96px;
  object-fit: cover;
  border: 2px solid ${({ theme }) => theme.color.text};
  margin-bottom: ${({ theme }) => theme.space[3]};
`

const SemFoto = styled.div`
  width: 96px;
  height: 96px;
  display: grid;
  place-items: center;
  border: 2px dashed ${({ theme }) => theme.color.divider};
  color: ${({ theme }) => theme.color.muted};
  font-size: 11px;
  margin-bottom: ${({ theme }) => theme.space[3]};
`

const Divisor = styled.hr`
  border: 0;
  border-top: 2px solid ${({ theme }) => theme.color.divider};
  margin: ${({ theme }) => theme.space[6]} 0;
`

/** Limite do bucket `avatars`; a checagem daqui é só para avisar antes de subir. */
const TAMANHO_MAXIMO = 2 * 1024 * 1024
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export default function Perfil() {
  const { user, session, carregando: carregandoSessao } = useAuth()

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
    if (error) {
      setErro(error.message)
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
    if (error) setErro(error.message)
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
    if (error) setErro(traduzirErroAuth(error))
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

    if (erroUpload) {
      setOcupado(false)
      setErro(erroUpload.message)
      return
    }

    const { data: publico } = supabase.storage.from('avatars').getPublicUrl(caminho)
    // A query no fim força o navegador a buscar de novo depois da troca.
    const url = `${publico.publicUrl}?v=${Date.now()}`

    const { error: erroPerfil } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', user.id)

    setOcupado(false)
    if (erroPerfil) setErro(erroPerfil.message)
    else {
      setAviso('Foto atualizada.')
      await carregar()
    }
    if (arquivoRef.current !== null) arquivoRef.current.value = ''
  }

  return (
    <Shell>
      <Card>
        <Kicker>Perfil</Kicker>
        <h1>Sua conta</h1>
        <Note>{user?.email}</Note>

        {erro !== null && <Alerta>{erro}</Alerta>}
        {aviso !== null && <Aviso>{aviso}</Aviso>}

        {perfil?.avatar_url ? (
          <Foto src={perfil.avatar_url} alt="Sua foto de perfil" />
        ) : (
          <SemFoto>sem foto</SemFoto>
        )}

        <Campo>
          Foto de perfil
          <input
            ref={arquivoRef}
            type="file"
            accept={TIPOS_ACEITOS.join(',')}
            disabled={ocupado}
            onChange={(e) => void enviarFoto(e)}
          />
        </Campo>

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
            Salvar dados
          </Botao>
        </Formulario>

        <Divisor />

        <Formulario onSubmit={(e) => void trocarSenha(e)}>
          <Kicker>Segurança</Kicker>
          <Note>
            Se você entrou com a senha padrão distribuída pelo organizador, troque agora por uma
            só sua.
          </Note>
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
          <Botao type="submit" disabled={ocupado}>
            Trocar senha
          </Botao>
        </Formulario>

        <LinhaAlternativa>
          <Link to="/home">Voltar</Link>
        </LinhaAlternativa>
      </Card>
    </Shell>
  )
}
