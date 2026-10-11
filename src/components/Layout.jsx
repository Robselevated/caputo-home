import BottomNav from './BottomNav'
import OfflineIndicator from './OfflineIndicator'
import { useAuth } from '../hooks/useAuth'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { RealtimeProvider } from '../providers/RealtimeProvider'

// App shell: no app-wide header (each page owns its title), the single
// offline-sync instance, the single realtime channel, and the tab bar.
export default function Layout({ children }) {
  const { profile } = useAuth()
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
