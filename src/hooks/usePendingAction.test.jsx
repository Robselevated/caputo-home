import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePendingAction } from './usePendingAction'

// A deferred, undo-able action: schedule(key, payload) hides the row now and
// runs the real action after `delayMs` unless cancel(key) is called first.
// Used for grocery check-off (1.5s) and kitchen delete (4s).
describe('usePendingAction', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('runs the action after the delay with the scheduled payload', () => {
    const action = vi.fn()
    const { result } = renderHook(() => usePendingAction(action, { delayMs: 1500 }))
    act(() => result.current.schedule('a', { id: 'a', name: 'Rice' }))
    expect(result.current.isPending('a')).toBe(true)
    expect(action).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1499))
    expect(action).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith({ id: 'a', name: 'Rice' })
    expect(result.current.isPending('a')).toBe(false)
  })

  it('cancel() within the window prevents the action', () => {
    const action = vi.fn()
    const { result } = renderHook(() => usePendingAction(action, { delayMs: 1500 }))
    act(() => result.current.schedule('a', { id: 'a' }))
    act(() => result.current.cancel('a'))
    act(() => vi.advanceTimersByTime(5000))
    expect(action).not.toHaveBeenCalled()
    expect(result.current.isPending('a')).toBe(false)
  })

  it('does NOT flush early when the component re-renders or the action identity changes (the GroceryList bug)', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result, rerender } = renderHook(({ fn }) => usePendingAction(fn, { delayMs: 1500 }), {
      initialProps: { fn: first },
    })
    act(() => result.current.schedule('a', { id: 'a' }))
    rerender({ fn: second })
    rerender({ fn: second })
    expect(first).not.toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1500))
    // latest action wins, called exactly once
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('flushes everything pending on pagehide so leaving the app keeps the change', () => {
    const action = vi.fn()
    const { result } = renderHook(() => usePendingAction(action, { delayMs: 1500 }))
    act(() => {
      result.current.schedule('a', { id: 'a' })
      result.current.schedule('b', { id: 'b' })
    })
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(action).toHaveBeenCalledTimes(2)
    act(() => vi.advanceTimersByTime(5000))
    expect(action).toHaveBeenCalledTimes(2) // no double-fire after timers elapse
  })

  it('flushes on unmount', () => {
    const action = vi.fn()
    const { result, unmount } = renderHook(() => usePendingAction(action, { delayMs: 1500 }))
    act(() => result.current.schedule('a', { id: 'a' }))
    unmount()
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('scheduling the same key twice restarts the timer and keeps the latest payload', () => {
    const action = vi.fn()
    const { result } = renderHook(() => usePendingAction(action, { delayMs: 1000 }))
    act(() => result.current.schedule('a', { id: 'a', v: 1 }))
    act(() => vi.advanceTimersByTime(800))
    act(() => result.current.schedule('a', { id: 'a', v: 2 }))
    act(() => vi.advanceTimersByTime(800))
    expect(action).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(200))
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith({ id: 'a', v: 2 })
  })
})
