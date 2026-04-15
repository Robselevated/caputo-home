import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-ivory">
      <div className="w-8 h-8 border-4 border-warmgray-300 border-t-transparent rounded-full animate-spin" />
    </div>
  )
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-ivory px-6">
      <img
        src="/caputoappicon.png"
        alt="Caputo Home"
        className="w-20 h-20 rounded-2xl shadow-dark-md mb-6"
      />
      <h1 className="font-heading text-2xl font-extrabold text-charcoal mb-1">
        Caputo Home
      </h1>
      <p className="text-warmgray-400 font-body text-sm mb-8">
        Sign in to access your household
      </p>
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          autoComplete="email"
          className="input-field w-full"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          autoComplete="current-password"
          className="input-field w-full"
        />
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded-xl">{error}</div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full disabled:opacity-40"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
