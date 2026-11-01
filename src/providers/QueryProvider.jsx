import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient } from '../lib/queryClient'
import { createQueryPersister, PERSIST_MAX_AGE, PERSIST_BUSTER } from '../lib/persister'

let defaultPersister = null

// Persist every query that still holds data, including one whose LAST refetch
// failed (timeout, offline): status is 'error' but the data is what we want on
// the next cold open. Only never-loaded queries are dropped.
export const shouldPersistQuery = (query) => query.state.data !== undefined

// Wraps the app in the shared query cache and restores the last snapshot from
// IndexedDB before queries run, so a cold open paints from what we had.
export function QueryProvider({ children, client = queryClient, persister }) {
  if (!persister && !defaultPersister) defaultPersister = createQueryPersister()
  const activePersister = persister ?? defaultPersister
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister: activePersister,
        maxAge: PERSIST_MAX_AGE,
        buster: PERSIST_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
        },
      }}
      // Every optimistic write bumps the snapshot's dataUpdatedAt, so a quick
      // force-close and reopen would otherwise paint it as fresh and never ask
      // the server (a row stuck "checked" after a failed check-off). Once the
      // snapshot is restored, mark it all stale so mounted queries refetch.
      onSuccess={() => client.invalidateQueries()}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
