/**
 * Guarda das rotas de administração.
 *
 * Esconde a tela de quem não é administrador — conveniência de interface.
 * Quem realmente barra a ação é a RLS e o `is_admin()` dentro de cada função
 * do banco (§45).
 */

import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { usePapeis } from '../auth/usePapeis'
import { Navegacao } from './Navegacao'
import { Pagina } from '../ui/Superficie'
import { Carregando, Vazio } from '../ui/Estados'
import { BotaoLink } from '../ui/Botao'

export function RotaAdmin({ children }: { children: ReactNode }) {
  const { session, carregando: carregandoSessao } = useAuth()
  const { ehAdmin, carregando: carregandoPapeis } = usePapeis()

  if (carregandoSessao || carregandoPapeis) {
    return (
      <>
        <Navegacao />
        <Pagina>
          <Carregando linhas={2} rotulo="Verificando permissões…" />
        </Pagina>
      </>
    )
  }

  if (session === null) return <Navigate to="/login" replace />

  if (!ehAdmin) {
    return (
      <>
        <Navegacao />
        <Pagina>
          <Vazio
            titulo="Área restrita"
            descricao="Sua conta não tem permissão de administrador."
            acao={
              <BotaoLink to="/home" $variante="primario">
                Voltar ao início
              </BotaoLink>
            }
          />
        </Pagina>
      </>
    )
  }

  return <>{children}</>
}
