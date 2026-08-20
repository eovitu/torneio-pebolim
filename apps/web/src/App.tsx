import { ThemeProvider } from 'styled-components'
import { Route, Routes } from 'react-router-dom'
import { GlobalStyle } from './design-system/GlobalStyle'
import { theme } from './design-system/theme'
import { AuthProvider } from './auth/AuthProvider'
import { RotaAdmin } from './components/Admin'
import BemVindo from './pages/BemVindo'
import Home from './pages/Home'
import Entrar from './pages/Entrar'
import Cadastro from './pages/Cadastro'
import NaoEncontrada from './pages/NaoEncontrada'
import Torneios from './pages/admin/Torneios'
import Torneio from './pages/admin/Torneio'

/**
 * Rotas em inglês, interface em português: a URL é identificador técnico, o
 * texto da tela é conteúdo do produto (§3).
 */
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <AuthProvider>
        <Routes>
          <Route path="/" element={<BemVindo />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Entrar />} />
          <Route path="/register" element={<Cadastro />} />
          <Route
            path="/admin/tournaments"
            element={
              <RotaAdmin>
                <Torneios />
              </RotaAdmin>
            }
          />
          <Route
            path="/admin/tournaments/:id"
            element={
              <RotaAdmin>
                <Torneio />
              </RotaAdmin>
            }
          />
          {/* Catch-all: qualquer endereço desconhecido cai na nossa 404. */}
          <Route path="*" element={<NaoEncontrada />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}
