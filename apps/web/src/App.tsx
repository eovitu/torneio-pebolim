import { Suspense, lazy } from 'react'
import { ThemeProvider } from 'styled-components'
import { Route, Routes } from 'react-router-dom'
import { GlobalStyle } from './design-system/GlobalStyle'
import { theme } from './design-system/theme'
import { AuthProvider } from './auth/AuthProvider'
import { PortaoDeRegras } from './components/PortaoDeRegras'
import { RotaAdmin } from './components/Admin'
import { Carregando } from './ui/Estados'
import { Pagina } from './ui/Superficie'
import BemVindo from './pages/BemVindo'
import Home from './pages/Home'
import Entrar from './pages/Entrar'
import Cadastro from './pages/Cadastro'

/**
 * Rotas em inglês, interface em português: a URL é identificador técnico, o
 * texto da tela é conteúdo do produto (§3).
 *
 * As telas de entrada (boas-vindas, login, cadastro e Home) vêm no bundle
 * inicial porque são o primeiro carregamento no celular. Todo o resto é
 * carregado sob demanda — a área administrativa, em especial, nunca deveria
 * pesar no download de quem não é administrador (§44).
 *
 * `/matches/:id`, `/tournaments/*` e `/players/:id` são públicas de propósito:
 * o espectador sem conta acompanha partida, tabela e perfis (§40).
 */

const Torneios = lazy(() => import('./pages/Torneios'))
const Torneio = lazy(() => import('./pages/Torneio'))
const Times = lazy(() => import('./pages/Times'))
const Time = lazy(() => import('./pages/Time'))
const Partidas = lazy(() => import('./pages/Partidas'))
const Partida = lazy(() => import('./pages/Partida'))
const Perfil = lazy(() => import('./pages/Perfil'))
const Jogador = lazy(() => import('./pages/Jogador'))
const Regras = lazy(() => import('./pages/Regras'))
const NaoEncontrada = lazy(() => import('./pages/NaoEncontrada'))
const PainelAdmin = lazy(() => import('./pages/admin/Painel'))
const AdminTorneios = lazy(() => import('./pages/admin/Torneios'))
const AdminTorneio = lazy(() => import('./pages/admin/Torneio'))
const AdminUsuarios = lazy(() => import('./pages/admin/Usuarios'))

/** Espera do code splitting — mesma linguagem de carregamento do resto. */
function Espera() {
  return (
    <Pagina>
      <Carregando linhas={3} rotulo="Carregando…" />
    </Pagina>
  )
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <AuthProvider>
        <PortaoDeRegras>
          <Suspense fallback={<Espera />}>
            <Routes>
              <Route path="/" element={<BemVindo />} />
              <Route path="/home" element={<Home />} />
              <Route path="/login" element={<Entrar />} />
              <Route path="/register" element={<Cadastro />} />

              <Route path="/tournaments" element={<Torneios />} />
              <Route path="/tournaments/:id" element={<Torneio />} />
              <Route path="/teams" element={<Times />} />
              <Route path="/teams/:id" element={<Time />} />
              <Route path="/matches" element={<Partidas />} />
              <Route path="/matches/:id" element={<Partida />} />
              <Route path="/players/:id" element={<Jogador />} />
              <Route path="/profile" element={<Perfil />} />
              <Route path="/rules" element={<Regras />} />

              <Route
                path="/admin"
                element={
                  <RotaAdmin>
                    <PainelAdmin />
                  </RotaAdmin>
                }
              />
              <Route
                path="/admin/tournaments"
                element={
                  <RotaAdmin>
                    <AdminTorneios />
                  </RotaAdmin>
                }
              />
              <Route
                path="/admin/tournaments/:id"
                element={
                  <RotaAdmin>
                    <AdminTorneio />
                  </RotaAdmin>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RotaAdmin>
                    <AdminUsuarios />
                  </RotaAdmin>
                }
              />

              {/* Catch-all: qualquer endereço desconhecido cai na nossa 404. */}
              <Route path="*" element={<NaoEncontrada />} />
            </Routes>
          </Suspense>
        </PortaoDeRegras>
      </AuthProvider>
    </ThemeProvider>
  )
}
