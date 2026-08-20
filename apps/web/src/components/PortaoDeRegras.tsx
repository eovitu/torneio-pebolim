/**
 * Portão das regras oficiais.
 *
 * Decisão do proprietário (20/08/2026): o modal de regras é obrigatório a cada
 * entrada no app. A maioria das contas é criada pelo administrador em
 * Admin → Contas, e essas pessoas nunca passam pelo cadastro — sem este portão
 * elas jamais veriam as regras que o campeonato aplica.
 *
 * "A cada entrada" quer dizer a cada SESSÃO/LOGIN, não a cada navegação: a
 * confirmação vive em memória no contexto de autenticação e some quando a
 * pessoa sai, troca de conta ou a sessão expira. Nada é gravado em
 * localStorage — isso furaria a regra ao sobreviver ao logout.
 *
 * O registro permanente de quem aceitou qual versão continua em
 * `rules_acceptance`; são duas coisas diferentes e de propósito. Se
 * `RULES_VERSION` mudar, o aceite gravado fica desatualizado e a confirmação
 * da próxima entrada grava a versão nova.
 *
 * Enquanto não confirmar, o app fica visível mas inerte: o modal cobre a tela,
 * não tem botão de cancelar e o Esc não fecha.
 */

import type { ReactNode } from 'react'
import { ModalRegras } from './ModalRegras'
import { useAuth } from '../auth/useAuth'

export function PortaoDeRegras({ children }: { children: ReactNode }) {
  const { session, carregando, regrasConfirmadasNestaSessao, confirmarRegras } = useAuth()

  // Visitante sem conta não é barrado: ele só lê o conteúdo público (§40).
  const precisaConfirmar = !carregando && session !== null && !regrasConfirmadasNestaSessao

  return (
    <>
      {children}
      {precisaConfirmar && (
        <ModalRegras
          aviso="Confirme as regras oficiais para continuar. Elas aparecem uma vez a cada vez que você entra."
          onAceitar={(versao) => void confirmarRegras(versao)}
        />
      )}
    </>
  )
}
