import { useContext } from 'react'
import { AuthContext } from './AuthContext'
import type { EstadoAutenticacao } from './AuthContext'

/** Sessão atual e ações de autenticação. Exige estar dentro de `AuthProvider`. */
export function useAuth(): EstadoAutenticacao {
  const contexto = useContext(AuthContext)
  if (contexto === null) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  }
  return contexto
}
