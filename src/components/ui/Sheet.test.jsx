import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sheet } from './Sheet'

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Edit"><p>body</p></Sheet>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a labelled dialog in a portal when open', () => {
    render(<Sheet open onClose={() => {}} title="Edit item"><p>body</p></Sheet>)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Edit item')
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('closes on Escape and on backdrop tap, not on a tap inside', () => {
    const onClose = vi.fn()
    render(<Sheet open onClose={onClose} title="Edit"><p>body</p></Sheet>)
    fireEvent.click(screen.getByText('body'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = render(<Sheet open onClose={() => {}} title="Edit"><p>body</p></Sheet>)
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Sheet open={false} onClose={() => {}} title="Edit"><p>body</p></Sheet>)
    expect(document.body.style.overflow).toBe('')
  })

  it('returns focus to the element that opened it', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { rerender } = render(<Sheet open onClose={() => {}} title="Edit"><button>inside</button></Sheet>)
    expect(document.activeElement).not.toBe(opener)
    rerender(<Sheet open={false} onClose={() => {}} title="Edit"><button>inside</button></Sheet>)
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('blocks touch scrolling through the backdrop and contains overscroll in the panel', () => {
    render(<Sheet open onClose={() => {}} title="Edit"><p>body</p></Sheet>)
    expect(screen.getByTestId('sheet-backdrop')).toHaveClass('touch-none')
    expect(screen.getByText('body').parentElement).toHaveClass('overscroll-contain')
  })

  it('focuses the panel itself, not the first field, so the keyboard stays down until a field is tapped', () => {
    render(<Sheet open onClose={() => {}} title="Edit"><input aria-label="Name" /></Sheet>)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })

  it('can take the full screen for a review', () => {
    render(<Sheet open size="full" onClose={() => {}} title="Still have these?"><p>body</p></Sheet>)
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toMatch(/h-\[100dvh\]/)
    expect(dialog.className).not.toMatch(/rounded-t/)
  })

  it('wraps Tab inside the sheet and skips hidden inputs', () => {
    render(
      <>
        <button>Behind</button>
        <Sheet open onClose={() => {}} title="Edit">
          <input aria-label="Name" />
          <input type="file" tabIndex={-1} aria-hidden="true" />
          <button>Save</button>
        </Sheet>
      </>
    )
    const close = screen.getByRole('button', { name: 'Close' })
    const save = screen.getByRole('button', { name: 'Save' })
    save.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(save)
  })
})
