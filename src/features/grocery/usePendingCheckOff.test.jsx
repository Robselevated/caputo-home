import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../components/ui/Toast', () => { const toast = vi.fn(() => 1); toast.dismiss = vi.fn(); return { toast } })

import { usePendingCheckOff } from './usePendingCheckOff'

const milk = { id: 'g1', name: 'Milk', checked: false }

function setup(checkResult = { error: null }) {
  const props = {
    checkItem: vi.fn(async () => checkResult),
    uncheckItem: vi.fn(),
    markChecked: vi.fn(),
    markUnchecked: vi.fn(),
    userId: 'u1',
    onCheck: vi.fn(),
    delayMs: 1000,
  }
  const hook = renderHook(() => usePendingCheckOff(props))
  return { ...hook, props }
}

describe('usePendingCheckOff push timing', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('does not send the push on tap, only after the undo window closes and the check-off saved', async () => {
    const { result, props } = setup()
    act(() => result.current.check(milk))
    expect(props.onCheck).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(props.checkItem).toHaveBeenCalledWith(milk, 'u1')
    expect(props.onCheck).toHaveBeenCalledWith(milk)
  })

  it('never sends the push when the tap is undone', async () => {
    const { result, props } = setup()
    act(() => result.current.check(milk))
    act(() => result.current.undo(milk))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(props.checkItem).not.toHaveBeenCalled()
    expect(props.onCheck).not.toHaveBeenCalled()
  })

  it('does not send the push when the check-off failed', async () => {
    const { result, props } = setup({ error: { message: 'x' } })
    act(() => result.current.check(milk))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(props.checkItem).toHaveBeenCalled()
    expect(props.onCheck).not.toHaveBeenCalled()
  })
})
