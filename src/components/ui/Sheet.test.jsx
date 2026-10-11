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
})
