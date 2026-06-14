import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  // Hold a loader until the boot session gate resolves (bounded to ~3s by
  // resolveInitialSession's timeout) so we never render data pages against an
  // unvalidated/expired token — the source of the "spinner forever" first open.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ivory">
        <div className="w-8 h-8 border-4 border-warmgray-300 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}
