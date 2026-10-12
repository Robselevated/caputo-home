import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider } from '../../components/ui/Toast'
import { ScanRecipeForm } from './ScanRecipeForm'

const files = (n) => Array.from({ length: n }, (_, i) => new File(['x'], `p${i}.png`, { type: 'image/png' }))

function setup(scan, onParsed = vi.fn()) {
  const utils = render(<ToastProvider><ScanRecipeForm scan={scan} onParsed={onParsed} /></ToastProvider>)
  const input = utils.container.querySelector('input[type="file"]')
  const pick = (list) => fireEvent.change(input, { target: { files: list } })
  return { ...utils, input, pick, onParsed }
}

describe('ScanRecipeForm', () => {
  it('accepts HEIC alongside every other image type', () => {
    const { input } = setup(vi.fn())
    expect(input).toHaveAttribute('accept', 'image/*,image/heic')
    expect(input).toHaveAttribute('multiple')
  })

  it('reads the picked photos in one call, shows the time estimate, then hands the result on', async () => {
    let resolveScan
    const scan = vi.fn(() => new Promise(r => { resolveScan = r }))
    const { pick, onParsed } = setup(scan)
    pick(files(3))
    expect(screen.getByText('3 photos picked')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /scan photos/i }))
    expect(scan).toHaveBeenCalledTimes(1)
    const [sent, opts] = scan.mock.calls[0]
    expect(sent).toHaveLength(3)
    expect(opts.signal).toBeInstanceOf(AbortSignal)
    expect(screen.getByRole('status')).toHaveTextContent('Reading 3 photos, about 10 seconds')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    const result = { parsed: { name: 'Soup', ingredients: [] }, skipped: [], tileCount: 3 }
    await act(async () => { resolveScan(result) })
    expect(onParsed).toHaveBeenCalledWith(result)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /choose photos/i })).toBeInTheDocument()
  })

  it('Cancel aborts the request, resets the form and shows no error', async () => {
    const scan = vi.fn((_, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => { const e = new Error('Cancelled'); e.name = 'AbortError'; reject(e) })
    }))
    const { pick, onParsed } = setup(scan)
    pick(files(2))
    fireEvent.click(screen.getByRole('button', { name: /scan photos/i }))
    const { signal } = scan.mock.calls[0][1]

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })) })
    expect(signal.aborted).toBe(true)
    expect(onParsed).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /choose photos/i })).toBeInTheDocument()
    expect(screen.queryByText(/cancelled/i)).not.toBeInTheDocument()
  })

  it('reports skipped photos in one toast and still applies the result', async () => {
    const result = {
      parsed: { name: 'Soup', ingredients: [] },
      skipped: [{ name: 'p0.png', reason: 'That photo format is not supported. Take a screenshot of it instead.' }],
      tileCount: 1,
    }
    const scan = vi.fn(async () => result)
    const { pick, onParsed } = setup(scan)
    pick(files(2))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /scan photos/i })) })
    expect(onParsed).toHaveBeenCalledWith(result)
    expect(screen.getByText('Skipped 1 photo: That photo format is not supported. Take a screenshot of it instead.')).toBeInTheDocument()
  })

  it('shows the error when the scan fails', async () => {
    const scan = vi.fn(async () => { throw new Error('We could not read a recipe in those photos.') })
    const { pick, onParsed } = setup(scan)
    pick(files(1))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /scan photos/i })) })
    expect(onParsed).not.toHaveBeenCalled()
    expect(screen.getByText('We could not read a recipe in those photos.')).toBeInTheDocument()
  })
})
