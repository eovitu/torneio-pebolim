/**
 * Criação de contas pelo administrador.
 *
 * A conta nasce já confirmada, com uma senha padrão que o organizador entrega
 * pessoalmente — não dependemos de e-mail de confirmação.
 *
 * A criação acontece na Edge Function `admin-criar-usuario`, e não aqui: ela
 * exige a service role key, que ignora toda a RLS e jamais pode chegar ao
 * navegador. A função confere pelo JWT se quem chamou é administrador.
 */

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { Etiqueta, Itens, Painel, Secao } from '../../components/Admin'
import {
  Alerta,
  Aviso,
  Botao,
  Campo,
  Entrada,
  ErroCampo,
  Formulario,
  LinhaAlternativa,
} from '../../components/Formulario'
import { Kicker, Note } from '../../components/Shell'

interface CamposUsuario {
  nome: string
  email: string
  senha: string
}

/** Senha padrão sugerida para os convidados; cada um troca no próprio perfil. */
const SENHA_PADRAO = 'SenhaPadrao'

export default function Usuarios() {
  const [perfis, setPerfis] = useState<Tables<'profiles'>[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CamposUsuario>({
    defaultValues: { nome: '', email: '', senha: SENHA_PADRAO },
  })

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('nome')
    if (error) setErro(error.message)
    else setPerfis(data)
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const criar = handleSubmit(async (campos) => {
    setErro(null)
    setAviso(null)

    const { data, error } = await supabase.functions.invoke<{ email?: string; erro?: string }>(
      'admin-criar-usuario',
      { body: { nome: campos.nome.trim(), email: campos.email.trim(), senha: campos.senha } },
    )

    if (error) {
      // A Edge Function devolve o motivo no corpo; o erro do cliente é genérico.
      const detalhe = data?.erro
      setErro(detalhe ?? 'Não foi possível criar a conta. Confira se o e-mail já existe.')
      return
    }
    if (data?.erro) {
      setErro(data.erro)
      return
    }

    setAviso(`Conta criada para ${data?.email ?? campos.email}.`)
    reset({ nome: '', email: '', senha: SENHA_PADRAO })
    await carregar()
  })

  return (
    <Painel>
      <Kicker>Administração</Kicker>
      <h1>Contas</h1>

      <Secao>
        <h2>Nova conta</h2>
        <Note>
          A conta é criada já confirmada. Entregue a senha para a pessoa e peça que ela troque no
          próprio perfil depois de entrar.
        </Note>
        <Formulario onSubmit={criar} noValidate>
          {erro !== null && <Alerta>{erro}</Alerta>}
          {aviso !== null && <Aviso>{aviso}</Aviso>}

          <Campo>
            Nome
            <Entrada
              {...register('nome', {
                required: 'Informe o nome.',
                minLength: { value: 2, message: 'Mínimo de 2 caracteres.' },
              })}
            />
            {errors.nome && <ErroCampo>{errors.nome.message}</ErroCampo>}
          </Campo>

          <Campo>
            E-mail
            <Entrada
              type="email"
              inputMode="email"
              {...register('email', { required: 'Informe o e-mail.' })}
            />
            {errors.email && <ErroCampo>{errors.email.message}</ErroCampo>}
          </Campo>

          <Campo>
            Senha inicial
            <Entrada
              {...register('senha', {
                required: 'Informe a senha.',
                minLength: { value: 6, message: 'Mínimo de 6 caracteres.' },
              })}
            />
            {errors.senha && <ErroCampo>{errors.senha.message}</ErroCampo>}
          </Campo>

          <Botao type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Criando…' : 'Criar conta'}
          </Botao>
        </Formulario>
      </Secao>

      <Secao>
        <h2>Contas existentes ({perfis.length})</h2>
        {perfis.length === 0 ? (
          <Note>Nenhuma conta ainda.</Note>
        ) : (
          <Itens>
            {perfis.map((p) => (
              <li key={p.id}>
                <span>{p.nome}</span>
                <Etiqueta>{p.id.slice(0, 8)}</Etiqueta>
              </li>
            ))}
          </Itens>
        )}
        <LinhaAlternativa>
          <Link to="/admin/tournaments">Torneios</Link> · <Link to="/home">Home</Link>
        </LinhaAlternativa>
      </Secao>
    </Painel>
  )
}
