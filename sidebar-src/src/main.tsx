import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { StandaloneRecorderPage } from './components/StandaloneRecorderPage'
import { ThemeToggle } from './components/ThemeToggle'
import { MessageCenterDock } from './components/MessageCenterDock'
import { initializeTheme } from './lib/theme'
import './styles.css'

// ?mode=recorder abre uma página avulsa só de gravação de áudio, sem login/
// contexto de lead — ver StandaloneRecorderPage.tsx pro porquê.
const isRecorderMode = new URLSearchParams(window.location.search).get('mode') === 'recorder'
const isMessageCenterMode = new URLSearchParams(window.location.search).get('mode') === 'message-center'
if (isMessageCenterMode) document.documentElement.classList.add('message-center-document')

void initializeTheme().then(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isMessageCenterMode ? <MessageCenterDock /> : isRecorderMode ? <><div className="theme-toolbar"><ThemeToggle /></div><StandaloneRecorderPage /></> : <App />}
  </StrictMode>,
))
