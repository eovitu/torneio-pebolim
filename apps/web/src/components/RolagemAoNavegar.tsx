/**
 * Reseta a rolagem para o topo a cada troca de rota.
 *
 * React Router (fora do Data Router com `<ScrollRestoration>`) não faz isso
 * sozinho: ao navegar de uma lista rolada para outra página, o navegador
 * mantém a posição de rolagem anterior. Como a barra de navegação é sticky,
 * o resultado é o topo da página nova nascendo por baixo dela — o mesmo tipo
 * de bug já visto no modal de regras (ver `ModalRegras.tsx`), aqui causado
 * por falta de reset de rolagem em vez de z-index.
 *
 * Centralizado aqui, uma vez, em vez de cada página cuidar da própria
 * rolagem.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function RolagemAoNavegar() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
