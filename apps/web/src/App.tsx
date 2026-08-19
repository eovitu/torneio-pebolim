import { ThemeProvider } from 'styled-components'
import styled from 'styled-components'
import { MATCH_DURATION_SECONDS, RULES_VERSION } from '@pebolim/domain'
import { GlobalStyle } from './design-system/GlobalStyle'
import { theme } from './design-system/theme'

const Shell = styled.main`
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.space[6]};
`

const Card = styled.section`
  width: 100%;
  max-width: ${({ theme }) => theme.layout.appMaxWidth};
  border: 2px solid ${({ theme }) => theme.color.divider};
  padding: ${({ theme }) => theme.space[6]};
  background: ${({ theme }) => theme.color.neutral[100]};
`

const Kicker = styled.p`
  margin: 0;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.accent};
`

const Note = styled.p`
  margin: ${({ theme }) => theme.space[3]} 0 0;
  font-size: 13px;
  color: ${({ theme }) => theme.color.muted};
`

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
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
    </ThemeProvider>
  )
}
