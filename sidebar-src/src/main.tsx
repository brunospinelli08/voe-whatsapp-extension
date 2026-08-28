import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { StandaloneRecorderPage } from './components/StandaloneRecorderPage'
import './styles.css'

// ?mode=recorder abre uma página avulsa só de gravação de áudio, sem login/
// contexto de lead — ver StandaloneRecorderPage.tsx pro porquê.
const isRecorderMode = new URLSearchParams(window.location.search).get('mode') === 'recorder'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isRecorderMode ? <StandaloneRecorderPage /> : <App />}
  </StrictMode>,
)
