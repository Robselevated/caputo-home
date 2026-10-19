import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../lib/recovery', () => ({ recoverFromChunkError: vi.fn(), looksLikeChunkError: () => false }))

import ErrorBoundary from './ErrorBoundary'
import { recoverFromChunkError } from '../lib/recovery'

function Boom() {
  throw new Error('kaboom')
}

const realLocation = window.location

afterEach(() => {
  Object.defineProperty(window, 'location', { value: realLocation, configurable: true, writable: true })
})

describe('ErrorBoundary', () => {
  it('Reload the app always reloads the page, even after the auto-recovery budget is spent', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { ...realLocation, reload }, configurable: true, writable: true })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    fireEvent.click(screen.getByRole('button', { name: 'Reload the app' }))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(recoverFromChunkError).not.toHaveBeenCalled()
    err.mockRestore()
  })
})
