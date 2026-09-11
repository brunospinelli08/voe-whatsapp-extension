// StandaloneRecorderPage.tsx
// Página avulsa (aba própria da extensão) só pra gravar áudio.
// Recebe ?requestId=xxx na URL e inclui no broadcast de volta pra
// sidebar — isso garante que só a sidebar que pediu a gravação
// aceita o áudio (evita duplicação entre múltiplas abas/sidebars).

import { useState } from 'react'
import { AudioRecorderPanel } from './AudioRecorderPanel'
import { fileToBase64 } from '../lib/fileBase64'

const requestId = new URLSearchParams(window.location.search).get('requestId')

export function StandaloneRecorderPage() {
  const [status, setStatus] = useState<'recording' | 'sent' | 'cancelled'>('recording')

  async function handleRecorded(file: File) {
    const base64 = await fileToBase64(file)
    chrome.runtime.sendMessage({
      type: 'VOE_AUDIO_HANDOFF',
      requestId: requestId ?? undefined,
      fileBase64: base64,
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
        <p>Audio enviado. Volte pra aba do WhatsApp Web — ele ja aparece anexado no agendamento.</p>
        <button className="secondary" onClick={() => window.close()}>Fechar esta aba</button>
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div className="standalone-recorder-done">
        <p className="muted">Gravacao descartada.</p>
        <button className="secondary" onClick={() => window.close()}>Fechar esta aba</button>
      </div>
    )
  }

  return (
    <div className="standalone-recorder-page">
      <p className="standalone-recorder-title">Gravar audio pra agendar</p>
      <AudioRecorderPanel onRecorded={handleRecorded} onCancel={handleCancel} />
    </div>
  )
}
