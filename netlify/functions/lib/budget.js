// One time budget per request. Netlify's docs say 60s for a synchronous
// function, but this site's edge cuts the connection at 30s with a bare HTML
// 504 (measured 2026-10-19: a 28s sleep returned, a 40s sleep did not). Plan
// for 26 so our own friendly timeout always answers first.
export const BUDGET_MS = 26000

export class TimeoutError extends Error {
  constructor(label = 'operation') {
    super(`${label} timed out`)
    this.name = 'TimeoutError'
    this.code = 'timeout'
  }
}

export function createDeadline(totalMs = BUDGET_MS, now = Date.now) {
  const start = now()
  const remaining = () => Math.max(0, totalMs - (now() - start))
  return {
    remaining,
    get expired() { return remaining() <= 0 },
    // An AbortSignal that fires at the smaller of the stage cap and the time left.
    signal(maxMs = Infinity) {
      const ms = Math.max(0, Math.min(maxMs, remaining()))
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(new TimeoutError('stage')), ms)
      timer.unref?.()
      controller.signal.timeoutMs = ms
      return controller.signal
    },
  }
}

export function withTimeout(promise, ms, label = 'operation') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) }
    )
  })
}
