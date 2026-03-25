export default function OfflineIndicator({ isOnline, pendingCount, syncing, onSync }) {
  if (isOnline && pendingCount === 0) return null

  return (
    <div className={`px-4 py-2 text-sm font-medium flex items-center justify-between ${
      isOnline ? 'bg-yellow-900/20 text-yellow-400' : 'bg-warmgray-100 text-warmgray-600'
    }`}>
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <div className="w-2 h-2 bg-warmgray-400 rounded-full" />
            <span>Offline mode</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 bg-yellow-400 rounded-full" />
            <span>{pendingCount} change{pendingCount !== 1 ? 's' : ''} to sync</span>
          </>
        )}
      </div>
      {isOnline && pendingCount > 0 && (
        <button
          onClick={onSync}
          disabled={syncing}
          className="text-yellow-400 font-semibold text-xs px-3 py-1 bg-yellow-900/30 rounded-full"
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  )
}
