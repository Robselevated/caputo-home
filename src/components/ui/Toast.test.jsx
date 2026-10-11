import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ToastProvider, toast } from './Toast'

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows a message queued from anywhere via the module-level toast()', () => {
    render(<ToastProvider><div /></ToastProvider>)
    act(() => { toast({ message: 'Rice removed' }) })
    expect(screen.getByRole('status')).toHaveTextContent('Rice removed')
  })

  it('auto-dismisses after its duration', () => {
    render(<ToastProvider><div /></ToastProvider>)
    act(() => { toast({ message: 'Saved', durationMs: 2000 }) })
    expect(screen.getByText('Saved')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('renders an action button that runs its handler and dismisses the toast', () => {
    const onClick = vi.fn()
    render(<ToastProvider><div /></ToastProvider>)
    act(() => { toast({ message: 'Rice removed', action: { label: 'Undo', onClick } }) })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Rice removed')).not.toBeInTheDocument()
  })

  it('keeps at most two toasts, dropping the oldest', () => {
    render(<ToastProvider><div /></ToastProvider>)
    act(() => {
      toast({ message: 'one' })
      toast({ message: 'two' })
      toast({ message: 'three' })
    })
    expect(screen.queryByText('one')).not.toBeInTheDocument()
    expect(screen.getByText('two')).toBeInTheDocument()
    expect(screen.getByText('three')).toBeInTheDocument()
  })

  it('dismiss() removes a toast by the id toast() returned', () => {
    render(<ToastProvider><div /></ToastProvider>)
    let id
    act(() => { id = toast({ message: 'temp' }) })
    expect(screen.getByText('temp')).toBeInTheDocument()
    act(() => { toast.dismiss(id) })
    expect(screen.queryByText('temp')).not.toBeInTheDocument()
  })
})
