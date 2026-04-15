import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'

export default function Login() {
  const { user, loading, signIn } = useAuth()

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-ivory">
      <div className="w-8 h-8 border-4 border-warmgray-300 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (user) return <Navigate to="/" replace />

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
      <button
        onClick={signIn}
        className="flex items-center gap-3 px-6 py-3 bg-white border border-warmgray-200 rounded-xl shadow-dark-sm font-body text-sm font-medium text-charcoal hover:shadow-dark-md active:scale-95 transition-all"
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  )
}
