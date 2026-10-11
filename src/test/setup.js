import '@testing-library/jest-dom/vitest'
import { notifyManager } from '@tanstack/react-query'

// TanStack batches observer notifications on a macrotask (setTimeout 0), which
// lands AFTER act() resolves and makes rendered data lag the cache by a tick.
// Deliver them synchronously in tests so assertions see the cache right away.
notifyManager.setScheduler((cb) => cb())
