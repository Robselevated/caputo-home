import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../components/ui/Toast', () => {
  const toast = vi.fn(() => 7)
  toast.dismiss = vi.fn()
  return { toast }
})

import { toast } from '../components/ui/Toast'
import { useDeleteWithUndo } from './useDeleteWithUndo'

const rice = { id: 'a', name: 'Rice' }

describe('useDeleteWithUndo', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks() })
  afterEach(() => vi.useRealTimers())

  it('hides the item immediately and shows an Undo toast without deleting yet', () => {
    const deleteItem = vi.fn(async () => ({ error: null }))
    const { result } = renderHook(() => useDeleteWithUndo(deleteItem, { delayMs: 4000 }))
    act(() => result.current.requestDelete(rice))
    expect(result.current.isHidden('a')).toBe(true)
    expect(deleteItem).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Rice'),
      action: expect.objectContaining({ label: 'Undo' }),
    }))
  })

  it('deletes for real once the undo window closes', () => {
    const deleteItem = vi.fn(async () => ({ error: null }))
    const { result } = renderHook(() => useDeleteWithUndo(deleteItem, { delayMs: 4000 }))
    act(() => result.current.requestDelete(rice))
    act(() => vi.advanceTimersByTime(4000))
    expect(deleteItem).toHaveBeenCalledTimes(1)
    expect(deleteItem).toHaveBeenCalledWith('a')
    expect(result.current.isHidden('a')).toBe(false)
  })

  it('Undo cancels the delete and un-hides the item', () => {
    const deleteItem = vi.fn(async () => ({ error: null }))
    const { result } = renderHook(() => useDeleteWithUndo(deleteItem, { delayMs: 4000 }))
    act(() => result.current.requestDelete(rice))
    const undo = toast.mock.calls[0][0].action.onClick
    act(() => undo())
    expect(result.current.isHidden('a')).toBe(false)
    act(() => vi.advanceTimersByTime(10000))
    expect(deleteItem).not.toHaveBeenCalled()
  })

  it('dismisses its toast when the delete finally runs', () => {
    const deleteItem = vi.fn(async () => ({ error: null }))
    const { result } = renderHook(() => useDeleteWithUndo(deleteItem, { delayMs: 4000 }))
    act(() => result.current.requestDelete(rice))
    act(() => vi.advanceTimersByTime(4000))
    expect(toast.dismiss).toHaveBeenCalledWith(7)
  })

  it('flushes on unmount so navigating away still deletes', () => {
    const deleteItem = vi.fn(async () => ({ error: null }))
    const { result, unmount } = renderHook(() => useDeleteWithUndo(deleteItem, { delayMs: 4000 }))
    act(() => result.current.requestDelete(rice))
    unmount()
    expect(deleteItem).toHaveBeenCalledWith('a')
  })
})
