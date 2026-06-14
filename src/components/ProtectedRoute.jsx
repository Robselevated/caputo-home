import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'
import { softReloadViaRecovery } from '../lib/recovery'
import { BUILD_ID } from '../lib/buildId'

function VersionStamp() {
  return <p className="mt-6 text-warmgray-300 text-[11px] tracking-wide">v{BUILD_ID}</p>
}

function BootLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-ivory">
      <div className="w-8 h-8 border-4 border-warmgray-300 border-t-transparent rounded-full animate-spin" />
      <VersionStamp />
    </div>
  )
}

export default function ProtectedRoute({ children }) {
  const { user, loading, profile, profileError, retryProfile } = useAuth()

  // Hold a loader until the boot session gate resolves (bounded to ~3s by
  // resolveInitialSession's timeout).
  if (loading) return <BootLoader />

  if (!user) return <Navigate to="/login" replace />

  // Every protected page needs the household id (profile.household_id). Wait for
  // it here — but NEVER forever: the watchdog in useAuth trips profileError, and
  // the SDK fetch timeout means a stalled refresh can't strand us. This replaces
  // the old "in-shell spinner that spins forever" with a bounded, recoverable state.
  if (!profile) {
    if (profileError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-ivory px-6 text-center">
          <h2 className="font-heading text-lg font-bold text-charcoal mb-2">Can't reach the server</h2>
          <p className="text-warmgray-500 text-sm mb-5">Check your connection and try again.</p>
          <div className="flex gap-3">
            <button onClick={retryProfile} className="btn-primary px-5 py-2">Retry</button>
            <button
              onClick={softReloadViaRecovery}
              className="px-5 py-2 rounded-2xl border border-warmgray-300 text-charcoal active:scale-95 transition-transform"
            >
              Reload
            </button>
          </div>
          <VersionStamp />
        </div>
      )
    }
    return <BootLoader />
  }

  return children
}
