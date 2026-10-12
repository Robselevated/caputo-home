// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createDeadline, withTimeout } from './budget.js'

describe('createDeadline', () => {
  it('counts down from the total and reports expiry', () => {
    let t = 1000
    const d = createDeadline(5000, () => t)
    expect(d.remaining()).toBe(5000)
    t += 3000
    expect(d.remaining()).toBe(2000)
    expect(d.expired).toBe(false)
    t += 2500
    expect(d.remaining()).toBe(0)
    expect(d.expired).toBe(true)
  })

  it('hands out a signal that aborts at the smaller of the stage cap and the time left', async () => {
    let t = 0
    const d = createDeadline(5000, () => t)
    const s = d.signal(8000)
    expect(s.aborted).toBe(false)
    await new Promise(r => setTimeout(r, 20))
    expect(s.timeoutMs).toBe(5000)
  })
})

describe('withTimeout', () => {
  it('rejects with a TimeoutError when the promise is too slow', async () => {
    const slow = new Promise(r => setTimeout(() => r('late'), 200))
    await expect(withTimeout(slow, 20, 'fetch')).rejects.toMatchObject({ name: 'TimeoutError' })
    await expect(withTimeout(Promise.resolve('fast'), 50, 'fetch')).resolves.toBe('fast')
  })
})
