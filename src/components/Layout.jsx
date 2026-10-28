import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'
import BottomNav from './BottomNav'
import OfflineIndicator from './OfflineIndicator'
import { useAuth } from '../hooks/useAuth'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { RealtimeProvider } from '../providers/RealtimeProvider'

// A new page opens at the top. Without this the browser keeps the scroll of
// the page you tapped from, so a detail page can open with its back link
// already under the status bar. Back/forward (POP) keeps the browser's own
// restore so a list comes back where you left it.
function useScrollToTopOnNavigate() {
  const { pathname } = useLocation()
  const type = useNavigationType()
  useEffect(() => {
    if (type !== 'POP') window.scrollTo(0, 0)
  }, [pathname, type])
}

// App shell: no app-wide header (each page owns its title), the single
// offline-sync instance, the single realtime channel, and the tab bar.
export default function Layout({ children }) {
  const { profile } = useAuth()
  useScrollToTopOnNavigate()
  const householdId = profile?.household_id
  const { isOnline, pendingCount, syncing, syncNow } = useOfflineSync(householdId)

  return (
    <RealtimeProvider householdId={householdId}>
      <div className="min-h-screen bg-ground">
        <main className="mx-auto max-w-md pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
          <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} syncing={syncing} onSync={syncNow} />
          {children}
        </main>
        <BottomNav />
      </div>
    </RealtimeProvider>
  )
}
