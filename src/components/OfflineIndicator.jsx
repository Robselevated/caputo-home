import { CloudOff, RefreshCw } from 'lucide-react'

export default function OfflineIndicator({ isOnline, pendingCount, syncing, onSync }) {
  if (isOnline && pendingCount === 0) return null
  const changes = `${pendingCount} change${pendingCount !== 1 ? 's' : ''} to sync`
  return (
    <div className="mx-5 mb-3 flex items-center justify-between gap-3 rounded-row bg-control px-4 py-2.5 text-sm font-medium text-ink-2">
      <span className="flex items-center gap-2">
        {isOnline ? <RefreshCw size={16} aria-hidden="true" /> : <CloudOff size={16} aria-hidden="true" />}
        {isOnline ? changes : `Offline${pendingCount > 0 ? `, ${changes}` : ''}`}
      </span>
      {isOnline && pendingCount > 0 && (
        <button type="button" onClick={onSync} disabled={syncing} className="h-10 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-white disabled:opacity-50">
          {syncing ? 'Syncing' : 'Sync now'}
        </button>
      )}
    </div>
  )
}
