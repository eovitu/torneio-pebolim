/**
 * Cadastro com aceite obrigatório das regras (§17).
 *
 * O aceite não é uma caixa que se marca: marcar abre o modal, e a confirmação
 * só existe depois de rolar o texto inteiro. A versão lida é gravada junto com
 * o cadastro, para que se saiba exatamente qual redação a pessoa aceitou.
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { Card, Kicker, Note, Shell } from '../components/Shell'
import {
  Alerta,
  Aviso,
  Botao,
  Campo,
  Entrada,
  ErroCampo,
  Formulario,
  LinhaAlternativa,
} from '../components/Formulario'
import { ModalRegras } from '../components/ModalRegras'
import { useAuth } from '../auth/useAuth'

const LinhaAceite = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space[3]};
  font-size: 13px;

  input {
    width: 22px;
    height: 22px;
    margin: 0;
    flex-shrink: 0;
    accent-color: ${({ theme }) => theme.color.accent};
  }

  button {
    font: inherit;
    padding: 0;
    border: 0;
    background: none;
    color: ${({ theme }) => theme.color.accent};
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
  }
`

interface CamposCadastro {
  nome: string
  email: string
  senha: string
}

export default function Cadastro() {
  const { cadastrar, session, carregando } = useAuth()
  const navigate = useNavigate()

  const [modalAberto, setModalAberto] = useState(false)
  const [versaoAceita, setVersaoAceita] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmeEmail, setConfirmeEmail] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CamposCadastro>({ defaultValues: { nome: '', email: '', senha: '' } })

  if (!carregando && session !== null) return <Navigate to="/" replace />

  const aoEnviar = handleSubmit(async ({ nome, email, senha }) => {
    setErro(null)
    if (versaoAceita === null) {
      setErro('É preciso ler e aceitar as regras para se cadastrar.')
      return
    }
    try {
      const { precisaConfirmarEmail } = await cadastrar({
        nome: nome.trim(),
        email: email.trim(),
        senha,
        versaoRegrasAceita: versaoAceita,
      })
      if (precisaConfirmarEmail) setConfirmeEmail(true)
      else navigate('/', { replace: true })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir o cadastro.')
    }
  })

  if (confirmeEmail) {
    return (
      <Shell>
        <Card>
          <Kicker>Pebolim · Torneio</Kicker>
          <h1>Confirme seu e-mail</h1>
          <Note>
            Enviamos um link de confirmação. Abra-o para ativar sua conta e depois entre
            normalmente.
          </Note>
          <Formulario as="div">
            <LinhaAlternativa>
              Já confirmou? <Link to="/entrar">Entrar</Link>
            </LinhaAlternativa>
          </Formulario>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <Card>
        <Kicker>Pebolim · Torneio</Kicker>
        <h1>Criar conta</h1>
        <Note>A conta é necessária para participar e operar partidas.</Note>

        <Formulario onSubmit={aoEnviar} noValidate>
          {erro !== null && <Alerta>{erro}</Alerta>}

          <Campo>
            Nome
            <Entrada
              type="text"
              autoComplete="name"
              aria-invalid={errors.nome !== undefined}
              {...register('nome', {
                required: 'Informe seu nome.',
                minLength: { value: 2, message: 'O nome precisa ter ao menos 2 caracteres.' },
                maxLength: { value: 60, message: 'O nome pode ter no máximo 60 caracteres.' },
              })}
            />
            {errors.nome && <ErroCampo>{errors.nome.message}</ErroCampo>}
          </Campo>

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
              autoComplete="new-password"
              aria-invalid={errors.senha !== undefined}
              {...register('senha', {
                required: 'Escolha uma senha.',
                minLength: { value: 6, message: 'Use pelo menos 6 caracteres.' },
              })}
            />
            {errors.senha && <ErroCampo>{errors.senha.message}</ErroCampo>}
          </Campo>

          <LinhaAceite>
            <input
              type="checkbox"
              id="aceite"
              checked={versaoAceita !== null}
              onChange={(e) => {
                // Marcar não aceita nada por si: abre a leitura. Desmarcar revoga.
                if (e.target.checked) setModalAberto(true)
                else setVersaoAceita(null)
              }}
            />
            <label htmlFor="aceite">
              Li e aceito as{' '}
              <button type="button" onClick={() => setModalAberto(true)}>
                regras oficiais
              </button>{' '}
              do campeonato.
            </label>
          </LinhaAceite>

          {versaoAceita !== null && <Aviso>Regras versão {versaoAceita} aceitas.</Aviso>}

          <Botao type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Criando conta…' : 'Criar conta'}
          </Botao>

          <LinhaAlternativa>
            Já tem conta? <Link to="/entrar">Entrar</Link>
          </LinhaAlternativa>
        </Formulario>
      </Card>

      {modalAberto && (
        <ModalRegras
          onCancelar={() => setModalAberto(false)}
          onAceitar={(versao) => {
            setVersaoAceita(versao)
            setModalAberto(false)
          }}
        />
      )}
    </Shell>
  )
}
