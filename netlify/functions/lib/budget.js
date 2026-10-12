// One time budget per request. Netlify gives a synchronous function 60s; we
// plan for 50 and hand each stage whatever is left.
export class TimeoutError extends Error {
  constructor(label = 'operation') {
    super(`${label} timed out`)
    this.name = 'TimeoutError'
    this.code = 'timeout'
  }
}

export function createDeadline(totalMs = 50000, now = Date.now) {
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
