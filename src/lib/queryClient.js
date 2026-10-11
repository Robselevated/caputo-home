import { QueryClient } from '@tanstack/react-query'
import { PERSIST_MAX_AGE } from './persister'

// One client for the whole app, importable from non-React code (resume
// handler, offline sync, realtime) so they can patch or invalidate the cache.
// gcTime must be >= the persister's maxAge or restored queries are collected
// before they are shown.
export const GC_TIME = PERSIST_MAX_AGE

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: GC_TIME,
      staleTime: 30 * 1000,
      retry: 1,
      // The resume handler (sessionManager) is the single "we're back" trigger.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Offline: keep showing persisted data instead of erroring.
      networkMode: 'online',
    },
  },
})
