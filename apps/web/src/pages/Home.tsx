import { MATCH_DURATION_SECONDS, RULES_VERSION } from '@pebolim/domain'
import { Card, Kicker, Note, Shell } from '../components/Shell'

export default function Home() {
  return (
    <Shell>
      <Card>
        <Kicker>Pebolim · Torneio</Kicker>
        <h1>Torneio de Pebolim</h1>
        <Note>
          Base do projeto configurada. Domínio das regras ativo — partida de{' '}
          {MATCH_DURATION_SECONDS} segundos, regras versão {RULES_VERSION}.
        </Note>
      </Card>
    </Shell>
  )
}
