export default function OfflineIndicator({ isOnline, pendingCount, syncing, onSync }) {
  if (isOnline && pendingCount === 0) return null

  return (
    <div className={`px-4 py-2 text-sm font-medium flex items-center justify-between ${
      isOnline ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-100 text-gray-600'
    }`}>
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
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
          className="text-yellow-600 font-semibold text-xs px-3 py-1 bg-yellow-100 rounded-full"
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  )
}
