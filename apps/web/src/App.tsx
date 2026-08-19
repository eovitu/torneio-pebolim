import { ThemeProvider } from 'styled-components'
import { Route, Routes } from 'react-router-dom'
import { GlobalStyle } from './design-system/GlobalStyle'
import { theme } from './design-system/theme'
import Home from './pages/Home'
import NaoEncontrada from './pages/NaoEncontrada'

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Catch-all: qualquer endereço desconhecido cai na nossa 404. */}
        <Route path="*" element={<NaoEncontrada />} />
      </Routes>
    </ThemeProvider>
  )
}
