import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email)
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
        <div className="card max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Check your email</h2>
          <p className="text-gray-500 text-sm">
            We sent a login link to <span className="font-medium text-gray-700">{email}</span>
          </p>
          <button
            onClick={() => { setSent(false); setEmail('') }}
            className="mt-6 text-sm text-green-600 font-medium"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-olive rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-3xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Caputo Home</h1>
          <p className="text-gray-500 mt-1">Sign in with your email</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="input-field focus:ring-olive"
          />

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary bg-olive hover:bg-olive/90 w-full disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>
      </div>
    </div>
  )
}
