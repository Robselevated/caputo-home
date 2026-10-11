# Offline and caching

How Caputo Home keeps data on screen without the network, and how writes made
offline reach Supabase later.

## Scope

Every list the app has loaded (grocery, kitchen inventory for all locations,
recently bought, recipes, meal picks, item history) is served from a persisted
cache, so all tabs read offline. Writes queue offline for the grocery list and
the kitchen (add / merge, quantity and edit changes, deletes, check-offs).
Cookbook writes (imports, edits) still need the network.

## Architecture

1. **TanStack Query cache** (`src/lib/queryClient.js`, `src/queries/*`): one
   shared in-memory cache for the whole app. Pages never refetch on mount while
   their data is fresh (`staleTime` per table in `src/queries/keys.js`); every
   write patches the cache first (optimistic) and rolls back row-by-row with a
   toast if the server says no.
2. **Persisted snapshot** (`src/lib/persister.js`, `src/providers/QueryProvider.jsx`):
   the cache is written to IndexedDB database `caputo-rq` (throttled to once a
   second) and restored before the first query runs, so a cold open paints the
   last known lists at once. Any query that still holds data is persisted, even
   if its last refetch failed. Snapshots older than 7 days, or written by an
   older cache version (`buster`), are dropped.
3. **Realtime** (`src/providers/RealtimeProvider.jsx`, `src/lib/realtimeCache.js`):
   ONE channel per household, mounted in `Layout`, patches the cache by row id
   for every table. Nothing refetches a whole list because of an event.
   DELETE events only reach the other phone once `REPLICA IDENTITY FULL` is set
   (see `sql/2026-10-11-hardening.sql`); until then the other phone drops the
   row on its next refetch (stale after 30 s, resume, or reconnect).
4. **Write queue** (`src/lib/db.js`, `src/hooks/useOfflineSync.js`): IndexedDB
   database `caputo-home` (version 1, never bumped: a rolled-back build must
   still open it). `useOfflineSync` is mounted once, in `Layout`, and replays
   the queue whenever connectivity returns, on any tab.
5. **Service worker** (vite-plugin-pwa / Workbox): precaches the app shell and
   runtime-caches Supabase Storage images and Google Fonts. It does NOT cache
   Supabase REST responses any more: a stale list used to resurrect deleted
   rows.

## IndexedDB

`caputo-rq` (store `kv`): one key, `caputo-rq-v1`, holding the serialized
query cache.

`caputo-home` (version 1):

- `write_queue` (keyPath `id`, autoIncrement, indexed by `timestamp`): queued
  mutations. Each entry has `type`, its payload, `timestamp`, `attempts`.
  - Grocery: `insert` (carries the client-generated row `id`), `update`,
    `delete`, `reorder`, `check` (replayed through `check_off_grocery_item`)
  - Kitchen: `inventory_merge` (replayed through `merge_inventory_item`; legacy
    `inventory_add` entries replay the same way), `inventory_update`,
    `inventory_delete`
- `grocery_items`: legacy mirror, no longer written or read.

`db.js` emits `onQueueChange(count)` after every queue change; the hook
subscribes instead of polling.

## Sequence

### Online

1. Boot restores the persisted cache (`ProtectedRoute` shows a blank ground
   for the few milliseconds that takes), then stale queries refetch in the
   background.
2. A write patches the cache, then goes to Supabase (client-generated UUIDs
   make the realtime echo idempotent). On failure the row is put back and a
   toast says so.
3. Realtime events from either phone patch the cache in place.
4. Resume (app hidden ≥ 10 s): the session is re-checked (bounded), the socket
   reconnected, and every active query refetched once. There is no forced
   reload any more.

### Offline

1. `offline` event: `OfflineIndicator` shows "Offline mode" on every page.
2. Writes still patch the cache, then go into `write_queue`.
3. Lists keep rendering from the cache; `pendingCount` shows the queue size.

### Back online

1. `online` event. TanStack also wants to refetch stale lists on this event;
   `syncNow` first CANCELS those refetches (the cache keeps the optimistic
   rows), then replays the queue oldest-first, then invalidates the grocery,
   kitchen and recently-bought lists so they catch up to the server.
2. A replay that fails (thrown, or a `{ error }` response) stays queued and its
   `attempts` counter increments; after 5 failures it is dropped and logged.

### Conflicts

Last write wins, in replay order. Acceptable for a two-person household.

## Push notifications

Separate from this flow (`usePushNotifications`, `send-push.js`); they need the
network.

## Key files

| File | Purpose |
|------|---------|
| `src/lib/queryClient.js`, `src/queries/keys.js` | cache defaults, keys, staleness |
| `src/queries/fetchers.js`, `src/queries/writes.js` | server reads and writes used by the hooks |
| `src/lib/persister.js`, `src/providers/QueryProvider.jsx` | IndexedDB persistence of the cache |
| `src/lib/realtimeCache.js`, `src/providers/RealtimeProvider.jsx` | one realtime channel, cache patching |
| `src/lib/db.js`, `src/hooks/useOfflineSync.js` | write queue, replay, pending count |
| `src/hooks/use*.js` | per-table hooks (optimistic writes, offline queuing) |
| `src/components/OfflineIndicator.jsx` | banner with the pending count |
