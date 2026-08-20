/**
 * Lista e criação de torneios (etapa 1 do fluxo).
 *
 * O torneio nasce em CONFIGURACAO. Quantas equipes e quantos jogadores por
 * equipe são configuráveis: o 4×2 é só o padrão do primeiro campeonato, nunca
 * uma regra fixa (§13).
 */

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { RULES_VERSION } from '@pebolim/domain'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'
import { useAuth } from '../../auth/useAuth'
import { Etiqueta, Itens, Painel, Secao } from '../../components/Admin'
import {
  Alerta,
  Botao,
  Campo,
  Entrada,
  ErroCampo,
  Formulario,
  LinhaAlternativa,
} from '../../components/Formulario'
import { Kicker, Note } from '../../components/Shell'
import { Navegacao } from '../../components/Navegacao'

interface CamposTorneio {
  nome: string
  slug: string
  max_equipes: number
  jogadores_por_equipe: number
}

export default function Torneios() {
  const { user } = useAuth()
  const [torneios, setTorneios] = useState<Tables<'tournaments'>[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CamposTorneio>({
    defaultValues: { nome: '', slug: '', max_equipes: 4, jogadores_por_equipe: 2 },
  })

  const carregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setErro(error.message)
    else setTorneios(data)
    setCarregando(false)
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const criar = handleSubmit(async (campos) => {
    setErro(null)
    if (user === null) return
    const { error } = await supabase.from('tournaments').insert({
      nome: campos.nome.trim(),
      slug: campos.slug.trim().toLowerCase(),
      max_equipes: Number(campos.max_equipes),
      jogadores_por_equipe: Number(campos.jogadores_por_equipe),
      // A versão vigente das regras fica congelada no torneio (§17).
      rules_version: RULES_VERSION,
      criado_por: user.id,
    })
    if (error) {
      setErro(error.message)
      return
    }
    reset()
    await carregar()
  })

  return (
    <>
      <Navegacao />
      <Painel>
        <Kicker>Administração</Kicker>
        <h1>Torneios</h1>

        <Secao>
          <h2>Novo torneio</h2>
          <Formulario onSubmit={criar} noValidate>
            {erro !== null && <Alerta>{erro}</Alerta>}

            <Campo>
              Nome
              <Entrada {...register('nome', { required: 'Informe o nome.' })} />
              {errors.nome && <ErroCampo>{errors.nome.message}</ErroCampo>}
            </Campo>

            <Campo>
              Identificador na URL
              <Entrada
                placeholder="copa-do-escritorio"
                {...register('slug', {
                  required: 'Informe o identificador.',
                  pattern: {
                    value: /^[a-z0-9][a-z0-9-]{1,60}$/,
                    message: 'Use apenas letras minúsculas, números e hífen.',
                  },
                })}
              />
              {errors.slug && <ErroCampo>{errors.slug.message}</ErroCampo>}
            </Campo>

            <Campo>
              Quantidade de equipes
              <Entrada
                type="number"
                min={2}
                {...register('max_equipes', {
                  required: 'Informe quantas equipes.',
                  min: { value: 2, message: 'Mínimo de 2 equipes.' },
                })}
              />
              {errors.max_equipes && <ErroCampo>{errors.max_equipes.message}</ErroCampo>}
            </Campo>

            <Campo>
              Jogadores por equipe
              <Entrada
                type="number"
                min={1}
                {...register('jogadores_por_equipe', {
                  required: 'Informe quantos jogadores por equipe.',
                  min: { value: 1, message: 'Mínimo de 1 jogador.' },
                })}
              />
              {errors.jogadores_por_equipe && (
                <ErroCampo>{errors.jogadores_por_equipe.message}</ErroCampo>
              )}
            </Campo>

            <Botao type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Criando…' : 'Criar torneio'}
            </Botao>
          </Formulario>
        </Secao>

        <Secao>
          <h2>Existentes</h2>
          {carregando ? (
            <Note>Carregando…</Note>
          ) : torneios.length === 0 ? (
            <Note>Nenhum torneio ainda. Crie o primeiro acima.</Note>
          ) : (
            <Itens>
              {torneios.map((t) => (
                <li key={t.id}>
                  <Link to={`/admin/tournaments/${t.id}`}>{t.nome}</Link>
                  <Etiqueta>
                    {t.status} · {t.max_equipes}×{t.jogadores_por_equipe}
                  </Etiqueta>
                </li>
              ))}
            </Itens>
          )}
          <LinhaAlternativa>
            <Link to="/home">Voltar para a home</Link>
          </LinhaAlternativa>
        </Secao>
      </Painel>
    </>
  )
}
