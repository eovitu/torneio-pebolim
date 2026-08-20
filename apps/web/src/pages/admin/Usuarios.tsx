/**
 * Criação de contas pelo administrador.
 *
 * A conta nasce já confirmada, com uma senha padrão que o organizador entrega
 * pessoalmente — não dependemos de e-mail de confirmação.
 *
 * A criação acontece na Edge Function `admin-criar-usuario`, e não aqui: ela
 * exige a service role key, que ignora toda a RLS e jamais pode chegar ao
 * navegador. A função confere pelo JWT se quem chamou é administrador.
 *
 * O redesign mexeu só na apresentação: layout, botões, feedback e estados. O
 * fluxo e as permissões são exatamente os mesmos.
 */

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { UserPlus, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { descreverErro } from '../../dados/campeonato'
import { Navegacao } from '../../components/Navegacao'
import { Bloco, Cartao, Pagina, Rotulo, Texto, TituloSecao } from '../../ui/Superficie'
import { Botao } from '../../ui/Botao'
import { Carregando, Erro, Sucesso, Vazio } from '../../ui/Estados'
import { Avatar, Badge } from '../../ui/Etiqueta'
import { Campo, Entrada, ErroCampo, Formulario } from '../../components/Formulario'
import styled from 'styled-components'
import { midia } from '../../design-system/tokens'

interface CamposUsuario {
  nome: string
  email: string
  senha: string
}

/** Senha padrão sugerida para os convidados; cada um troca no próprio perfil. */
const SENHA_PADRAO = 'SenhaPadrao'

const ListaContas = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[2]};

  ${midia.md} {
    grid-template-columns: 1fr 1fr;
  }
`

const LinhaConta = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => theme.space[3]};
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.fontSize.small};

  span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
`

/**
 * Extrai o motivo real de uma falha da Edge Function.
 *
 * `functions.invoke` devolve `data: null` quando a resposta não é 2xx — o
 * motivo fica no corpo, dentro de `error.context`. Sem ler dali, qualquer
 * falha (403, 500, indisponível) vira a mesma frase genérica, e foi assim que
 * um erro de permissão apareceu na tela como "o e-mail já existe".
 */
async function descreverErroDaFuncao(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const resposta = error.context as Response
    try {
      const corpo = (await resposta.clone().json()) as { erro?: string }
      if (typeof corpo.erro === 'string') return corpo.erro
    } catch {
      // corpo não era JSON; cai no texto abaixo
    }
    return `O servidor recusou a criação (HTTP ${resposta.status}).`
  }
  if (error instanceof FunctionsFetchError) {
    return 'Não foi possível falar com o servidor. Verifique sua conexão.'
  }
  if (error instanceof FunctionsRelayError) {
    return 'A função de criação de contas não respondeu. Tente de novo.'
  }
  return error instanceof Error ? error.message : 'Não foi possível criar a conta.'
}

export default function Usuarios() {
  const [perfis, setPerfis] = useState<Tables<'profiles'>[]>([])
  const [carregando, setCarregando] = useState(true)
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
    if (error !== null) setErro(descreverErro(error))
    else setPerfis(data)
    setCarregando(false)
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
      setErro(await descreverErroDaFuncao(error))
      return
    }
    if (data?.erro !== undefined) {
      setErro(data.erro)
      return
    }

    setAviso(`Conta criada para ${data?.email ?? campos.email}. Entregue a senha para a pessoa.`)
    reset({ nome: '', email: '', senha: SENHA_PADRAO })
    await carregar()
  })

  return (
    <>
      <Navegacao />
      <Pagina>
        <Bloco>
          <Rotulo $cor="acento">Administração</Rotulo>
          <h1>Contas</h1>
          <Texto $mudo>
            Crie contas para quem vai jogar. A conta nasce confirmada, com senha padrão — cada um
            troca a sua no próprio perfil depois de entrar.
          </Texto>
        </Bloco>

        {erro !== null && <Erro>{erro}</Erro>}
        {aviso !== null && <Sucesso>{aviso}</Sucesso>}

        <Bloco>
          <TituloSecao>
            <h2>
              <UserPlus size={20} aria-hidden="true" />
              Nova conta
            </h2>
          </TituloSecao>
          <Cartao>
            <Formulario onSubmit={criar} noValidate>
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

              <Botao type="submit" $tamanho="lg" disabled={isSubmitting}>
                {isSubmitting ? 'Criando…' : 'Criar conta'}
              </Botao>
            </Formulario>
          </Cartao>
        </Bloco>

        <Bloco>
          <TituloSecao>
            <h2>
              <Users size={20} aria-hidden="true" />
              Contas existentes
            </h2>
            <Badge $tom="marca">{perfis.length}</Badge>
          </TituloSecao>

          {carregando ? (
            <Carregando linhas={2} rotulo="Carregando contas…" />
          ) : perfis.length === 0 ? (
            <Vazio
              icone={<Users size={26} />}
              titulo="Nenhuma conta ainda"
              descricao="Crie a primeira conta no formulário acima."
            />
          ) : (
            <Cartao $compacto>
              <ListaContas>
                {perfis.map((p) => (
                  <LinhaConta key={p.id}>
                    <Avatar nome={p.nome} url={p.avatar_url} tamanho="sm" />
                    <span>{p.nome}</span>
                    <Badge $tom="neutro">{p.id.slice(0, 8)}</Badge>
                  </LinhaConta>
                ))}
              </ListaContas>
            </Cartao>
          )}
        </Bloco>
      </Pagina>
    </>
  )
}
