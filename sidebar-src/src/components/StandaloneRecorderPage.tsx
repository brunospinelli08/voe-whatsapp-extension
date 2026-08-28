// StandaloneRecorderPage.tsx
// Página avulsa (aba própria da extensão, chrome-extension://…/sidebar/
// index.html?mode=recorder) só pra gravar áudio — ver explicação completa
// em ScheduleMessagePanel.tsx ("Gravar áudio").
//
// Por quê isso existe, em vez de gravar direto na sidebar: a sidebar roda
// num iframe embutido dentro de web.whatsapp.com — mesmo com
// `allow="microphone"` no iframe (Permissions Policy, delega o "poder"
// pedir), o Chrome não concede microfone de fato pra um iframe
// cross-origin sem contexto de navegação de topo próprio; a tentativa
// falha com NotAllowedError sem nem chegar a mostrar o prompt de
// permissão pro usuário. Uma aba de verdade da extensão (chrome-extension://)
// É um contexto de topo — o Chrome pede a permissão normalmente ali, e o
// mesmo Blob gravado é devolvido pra sidebar por chrome.runtime.sendMessage
// (broadcast — todo contexto da extensão com onMessage recebe, incluindo o
// iframe da sidebar que ainda estiver aberto esperando).

import { useState } from 'react'
import { AudioRecorderPanel } from './AudioRecorderPanel'
import { fileToBase64 } from '../lib/fileBase64'

export function StandaloneRecorderPage() {
  const [status, setStatus] = useState<'recording' | 'sent' | 'cancelled'>('recording')

  async function handleRecorded(file: File) {
    const fileBase64 = await fileToBase64(file)
    chrome.runtime.sendMessage({
      type: 'VOE_AUDIO_HANDOFF',
      fileBase64,
      fileName: file.name,
      fileType: file.type,
    })
    setStatus('sent')
  }

  function handleCancel() {
    setStatus('cancelled')
  }

  if (status === 'sent') {
    return (
      <div className="standalone-recorder-done">
        <p>✅ Áudio enviado. Volte pra aba do WhatsApp Web — ele já aparece anexado no agendamento.</p>
        <button className="secondary" onClick={() => window.close()}>Fechar esta aba</button>
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div className="standalone-recorder-done">
        <p className="muted">Gravação descartada.</p>
        <button className="secondary" onClick={() => window.close()}>Fechar esta aba</button>
      </div>
    )
  }

  return (
    <div className="standalone-recorder-page">
      <p className="standalone-recorder-title">🎙️ Gravar áudio pra agendar</p>
      <AudioRecorderPanel onRecorded={handleRecorded} onCancel={handleCancel} />
    </div>
  )
}
