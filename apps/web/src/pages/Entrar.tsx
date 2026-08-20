import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Card, Kicker, Note, Shell } from '../components/Shell'
import {
  Alerta,
  Botao,
  Campo,
  Entrada,
  ErroCampo,
  Formulario,
  LinhaAlternativa,
} from '../components/Formulario'
import { useAuth } from '../auth/useAuth'

interface CamposLogin {
  email: string
  senha: string
}

export default function Entrar() {
  const { entrar, session, carregando } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CamposLogin>({ defaultValues: { email: '', senha: '' } })

  if (!carregando && session !== null) return <Navigate to="/" replace />


  const aoEnviar = handleSubmit(async ({ email, senha }) => {
    setErro(null)
    try {
      await entrar(email.trim(), senha)
      navigate('/', { replace: true })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.')
    }
  })

  return (
    <Shell>
      <Card>
        <Kicker>Pebolim · Torneio</Kicker>
        <h1>Entrar</h1>
        <Note>Use a conta que você cadastrou para operar partidas.</Note>

        <Formulario onSubmit={aoEnviar} noValidate>
          {erro !== null && <Alerta>{erro}</Alerta>}

          <Campo>
            E-mail
            <Entrada
              type="email"
              autoComplete="email"
              inputMode="email"
              aria-invalid={errors.email !== undefined}
              {...register('email', { required: 'Informe seu e-mail.' })}
            />
            {errors.email && <ErroCampo>{errors.email.message}</ErroCampo>}
          </Campo>

          <Campo>
            Senha
            <Entrada
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.senha !== undefined}
              {...register('senha', { required: 'Informe sua senha.' })}
            />
            {errors.senha && <ErroCampo>{errors.senha.message}</ErroCampo>}
          </Campo>

          <Botao type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </Botao>

          <LinhaAlternativa>
            Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link>
          </LinhaAlternativa>
        </Formulario>
      </Card>
    </Shell>
  )
}
