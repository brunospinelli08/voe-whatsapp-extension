// LoginScreen.tsx
import { FormEvent, useState } from 'react'

interface Props {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>
}

export function LoginScreen({ onSignIn }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await onSignIn(email, password)
    setSubmitting(false)
    if (signInError) setError(signInError)
  }

  return (
    <div className="login-screen">
      <h1>VOE — Atendimento</h1>
      <p className="login-subtitle">Entre com sua conta da VOE pra usar o fallback no WhatsApp Web.</p>

      <form onSubmit={handleSubmit}>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
