// AudioRecorderPanel.tsx
// Versão simplificada de AudioRecorder.tsx (app.voeops.com) — grava, para,
// ouve o preview, descarta ou usa. Sem pausar/retomar e sem waveform ao
// vivo (precisaria de AnalyserNode + animação por frame — fica de fora
// pra manter o escopo de uma feature nova enxuto; o essencial — gravar,
// conferir antes de anexar, descartar — está todo aqui).
//
// getUserMedia dentro do iframe da sidebar precisa do atributo
// `allow="microphone"` no <iframe> (ver content.js) — sem isso o browser
// bloqueia por Permissions Policy antes até de perguntar.

import { useCallback, useEffect, useRef, useState } from 'react'
import { TrashIcon, PauseIcon, PlayIcon, CheckIcon } from './Icons'

interface Props {
  onRecorded: (file: File) => void
  onCancel: () => void
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function AudioRecorderPanel({ onRecorded, onCancel }: Props) {
  const [phase, setPhase] = useState<'requesting' | 'recording' | 'preview' | 'error'>('requesting')
  const [time, setTime] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeTypeRef = useRef('audio/webm')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
            ? 'audio/ogg;codecs=opus'
            : 'audio/webm'
        mimeTypeRef.current = mimeType

        const mr = new MediaRecorder(stream, { mimeType })
        mediaRecorderRef.current = mr
        chunksRef.current = []
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        mr.start(250)

        setPhase('recording')
        timerRef.current = setInterval(() => setTime(t => t + 1), 1000)
      } catch (err) {
        if (cancelled) return
        setPhase('error')
        setErrorMsg(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Permissão de microfone negada. Autorize o acesso e tente de novo.'
            : 'Não foi possível acessar o microfone.',
        )
      }
    })()

    return () => {
      cancelled = true
      stopTimer()
      cleanupStream()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleStop() {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state === 'inactive') return
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
      blobRef.current = blob
      setPreviewUrl(URL.createObjectURL(blob))
      setPhase('preview')
    }
    mr.stop()
    stopTimer()
    cleanupStream()
  }

  function handleDiscard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    onCancel()
  }

  function togglePlay() {
    if (!audioRef.current) return
    if (playing) audioRef.current.pause()
    else audioRef.current.play().catch(() => {})
    setPlaying(p => !p)
  }

  function handleUse() {
    if (!blobRef.current) return
    const ext = mimeTypeRef.current.includes('ogg') ? 'ogg' : 'webm'
    const file = new File([blobRef.current], `audio-${Date.now()}.${ext}`, { type: mimeTypeRef.current })
    onRecorded(file)
  }

  if (phase === 'error') {
    return (
      <div className="audio-recorder audio-recorder-error">
        <p className="error-text">{errorMsg}</p>
        <button type="button" className="link-button" onClick={onCancel}>Fechar</button>
      </div>
    )
  }

  if (phase === 'requesting') {
    return <div className="audio-recorder muted">Pedindo acesso ao microfone…</div>
  }

  return (
    <div className="audio-recorder">
      <button type="button" className="audio-recorder-discard" onClick={handleDiscard} title="Descartar">
        <TrashIcon size={15} />
      </button>

      <div className="audio-recorder-body">
        {phase === 'recording' ? (
          <>
            <span className="audio-recorder-dot" />
            <span className="audio-recorder-time">{formatTime(time)}</span>
            <button type="button" className="audio-recorder-stop" onClick={handleStop} title="Parar">
              <PauseIcon size={14} />
            </button>
          </>
        ) : (
          <>
            {previewUrl && (
              <audio
                ref={audioRef}
                src={previewUrl}
                onEnded={() => setPlaying(false)}
              />
            )}
            <button type="button" className="audio-recorder-play" onClick={togglePlay}>
              {playing ? <PauseIcon size={11} /> : <PlayIcon size={11} />}
            </button>
            <span className="audio-recorder-time">{formatTime(time)}</span>
          </>
        )}
      </div>

      {phase === 'preview' && (
        <button type="button" className="audio-recorder-use" onClick={handleUse} title="Usar áudio">
          <CheckIcon size={14} />
        </button>
      )}
    </div>
  )
}
