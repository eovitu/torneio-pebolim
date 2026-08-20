import { Link } from 'react-router-dom'
import { MATCH_DURATION_SECONDS, RULES_VERSION } from '@pebolim/domain'
import { Card, Kicker, Note, Shell } from '../components/Shell'
import { Botao, Formulario, LinhaAlternativa } from '../components/Formulario'
import { useAuth } from '../auth/useAuth'
import { usePapeis } from '../auth/usePapeis'

export default function Home() {
  const { user, carregando, sair } = useAuth()
  const { ehAdmin } = usePapeis()

  return (
    <Shell>
      <Card>
        <Kicker>Pebolim · Torneio</Kicker>
        <h1>Torneio de Pebolim</h1>
        <Note>
          Base do projeto configurada. Domínio das regras ativo — partida de{' '}
          {MATCH_DURATION_SECONDS} segundos, regras versão {RULES_VERSION}.
        </Note>

        <Formulario as="div">
          {carregando ? (
            <Note>Carregando sessão…</Note>
          ) : user !== null ? (
            <>
              <Note>
                Conectado como <strong>{user.email}</strong>.
              </Note>
              <LinhaAlternativa>
                <Link to="/profile">Meu perfil</Link>
              </LinhaAlternativa>
              {ehAdmin && (
                <LinhaAlternativa>
                  <Link to="/admin/tournaments">Administrar torneios</Link> ·{' '}
                  <Link to="/admin/users">Contas</Link>
                </LinhaAlternativa>
              )}
              <Botao type="button" onClick={() => void sair()}>
                Sair
              </Botao>
            </>
          ) : (
            <LinhaAlternativa>
              <Link to="/login">Entrar</Link> ou <Link to="/register">criar conta</Link>.
            </LinhaAlternativa>
          )}
        </Formulario>
      </Card>
    </Shell>
  )
}
