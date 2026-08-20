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
import Perfil from './pages/Perfil'
import Partida from './pages/Partida'
import NaoEncontrada from './pages/NaoEncontrada'
import Torneios from './pages/admin/Torneios'
import Torneio from './pages/admin/Torneio'
import Usuarios from './pages/admin/Usuarios'

/**
 * Rotas em inglês, interface em português: a URL é identificador técnico, o
 * texto da tela é conteúdo do produto (§3).
 *
 * `/matches/:id` é pública de propósito — o espectador sem conta acompanha a
 * partida ao vivo (§40).
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
          <Route path="/profile" element={<Perfil />} />
          <Route path="/matches/:id" element={<Partida />} />
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
          <Route
            path="/admin/users"
            element={
              <RotaAdmin>
                <Usuarios />
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
