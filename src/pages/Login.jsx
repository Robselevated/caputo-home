import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

const HOUSEHOLD_EMAIL = 'caputo-home@family.local'

export default function Login() {
  const { signIn } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(HOUSEHOLD_EMAIL, pin)
    setLoading(false)
    if (error) setError(error.message || 'Wrong PIN')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-olive rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-3xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Caputo Home</h1>
          <p className="text-gray-500 mt-1">Enter PIN to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            required
            inputMode="numeric"
            maxLength={6}
            className="input-field focus:ring-olive text-center text-2xl tracking-[0.5em]"
          />

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !pin}
            className="btn-primary bg-olive hover:bg-olive/90 w-full disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
