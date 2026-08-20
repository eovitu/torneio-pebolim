/**
 * Contrato do contexto de autenticação.
 *
 * Vive separado do provider porque o Fast Refresh do Vite exige que um módulo
 * de componente exporte apenas componentes.
 */

import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface DadosCadastro {
  nome: string
  email: string
  senha: string
  /** Versão das regras que o usuário leu e aceitou no formulário (§17). */
  versaoRegrasAceita: string
}

export interface EstadoAutenticacao {
  session: Session | null
  user: User | null
  /** `true` enquanto a sessão persistida ainda não foi restaurada. */
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<void>
  cadastrar: (dados: DadosCadastro) => Promise<{ precisaConfirmarEmail: boolean }>
  sair: () => Promise<void>
}

export const AuthContext = createContext<EstadoAutenticacao | null>(null)
