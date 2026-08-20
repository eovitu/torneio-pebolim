import { ThemeProvider } from 'styled-components'
import { Route, Routes } from 'react-router-dom'
import { GlobalStyle } from './design-system/GlobalStyle'
import { theme } from './design-system/theme'
import { AuthProvider } from './auth/AuthProvider'
import Home from './pages/Home'
import Entrar from './pages/Entrar'
import Cadastro from './pages/Cadastro'
import NaoEncontrada from './pages/NaoEncontrada'

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/cadastro" element={<Cadastro />} />
          {/* Catch-all: qualquer endereço desconhecido cai na nossa 404. */}
          <Route path="*" element={<NaoEncontrada />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}
