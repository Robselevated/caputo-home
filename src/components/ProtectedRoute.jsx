import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'
import { useIsRestoring } from '@tanstack/react-query'
import { softReloadViaRecovery } from '../lib/recovery'
import BootScreen from './BootScreen'
import { Button } from './ui/Button'

function BootLoader() {
  return <BootScreen message="Opening your kitchen" />
}

export default function ProtectedRoute({ children }) {
  const { user, loading, profile, profileError, retryProfile, signOut } = useAuth()
  const isRestoring = useIsRestoring()

  // Hold a loader until the boot session gate resolves (bounded to ~3s by
  // resolveInitialSession's timeout). Only a first login gets here.
  if (loading) return <BootLoader />

  if (!user) return <Navigate to="/login" replace />

  // The persisted query cache is being read from IndexedDB (tens of ms). A
  // blank ground reads as "instant"; a spinner would read as "loading".
  if (isRestoring) return <div className="min-h-screen bg-ground" />

  // Every protected page needs the household id (profile.household_id). Wait
  // for it here, but never forever: the watchdog in useAuth trips profileError,
  // and the SDK fetch timeout means a stalled refresh cannot strand us. This
  // replaces the old "in-shell spinner that spins forever" with a bounded,
  // recoverable state.
  if (!profile) {
    if (profileError) {
      return (
        <BootScreen heading="Can't reach the server" message="Check your connection and try again.">
          <div className="mt-5 flex gap-2">
            <Button variant="secondary" onClick={retryProfile}>Retry</Button>
            <Button variant="secondary" onClick={softReloadViaRecovery}>Reload</Button>
          </div>
          <Button variant="ghost" onClick={signOut} className="mt-2">Sign out</Button>
        </BootScreen>
      )
    }
    return <BootLoader />
  }

  return children
}
