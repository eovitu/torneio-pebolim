/**
 * Papéis do usuário logado.
 *
 * Serve só para a interface decidir o que mostrar. Nenhuma autorização real
 * depende disto: `user_roles` é protegida por RLS e toda ação administrativa
 * revalida `is_admin()` no servidor (§45). Esconder o botão é conveniência,
 * não segurança.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Enums } from '../lib/database.types'
import { useAuth } from './useAuth'

export type Papel = Enums<'app_role'>

export function usePapeis() {
  const { user } = useAuth()
  const [papeis, setPapeis] = useState<Papel[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    if (user === null) {
      setPapeis([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) console.error('[papeis]', error.message)
        setPapeis((data ?? []).map((l) => l.role))
        setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [user])

  return {
    papeis,
    carregando,
    ehAdmin: papeis.includes('ADMIN') || papeis.includes('FACTORY_ADMIN'),
    ehAdminDeFabrica: papeis.includes('FACTORY_ADMIN'),
  }
}
