import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { BUILD_ID } from '../lib/buildId'

export default function Login() {
  const { user, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ground px-5 py-8">
      <div className="flex w-full max-w-xs flex-col items-center">
        <img src="/splash-icon.png" alt="" width="80" height="80" className="mb-5 h-20 w-20 rounded-tile shadow-soft" />
        <h1 className="font-heading text-[32px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">Caputo Home</h1>
        <p className="mt-1.5 text-sm text-ink-2">Sign in to your household</p>

        <form onSubmit={handleSubmit} aria-label="Sign in" className="mt-8 flex w-full flex-col gap-4">
          <Field label="Email" htmlFor="login-email">
            <Input id="login-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Field label="Password" htmlFor="login-password">
            <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          {error && <p role="alert" className="rounded-row bg-danger-tile px-4 py-3 text-sm font-medium text-danger-ink">{error}</p>}
          <Button type="submit" className="w-full bg-accent-grocery" disabled={submitting}>
            {submitting ? 'Signing in' : 'Sign in'}
          </Button>
        </form>
      </div>
      <p className="mt-8 text-[11px] tracking-wide text-ink-3">v{BUILD_ID}</p>
    </div>
  )
}
