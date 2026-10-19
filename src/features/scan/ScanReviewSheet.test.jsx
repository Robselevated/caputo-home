import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import ScanReview from './ScanReviewSheet'

const items = [
  { name: 'Rice', qty: 2, unit: 'bags', category: 'Dry Goods' },
  { name: 'Black beans', qty: 1, category: 'Canned Goods', needs_verification: true, verification_prompt: 'Could be pinto' },
]

function renderSheet(props = {}) {
  const onConfirm = vi.fn(async () => {})
  const onCancel = vi.fn()
  render(<ScanReview items={items} onConfirm={onConfirm} onCancel={onCancel} location="pantry" {...props} />)
  return { onConfirm, onCancel }
}

describe('ScanReviewSheet', () => {
  it('opens as a sheet named for the count, with one row per item and the location in the subtitle', () => {
    renderSheet()
    const dialog = screen.getByRole('dialog', { name: 'Found 2 items' })
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Pantry' })).toBeInTheDocument()
    expect(within(dialog).getByText('Rice')).toBeInTheDocument()
    expect(within(dialog).getByText('Black beans')).toBeInTheDocument()
    expect(within(dialog).getByText(/Could be pinto/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Add 2 to Pantry' })).toBeInTheDocument()
  })

  it('deselecting a row drops it from the confirm and the button count follows', async () => {
    const { onConfirm } = renderSheet()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Black beans' }))
    const confirm = screen.getByRole('button', { name: 'Add 1 to Pantry' })
    await act(async () => { fireEvent.click(confirm) })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [confirmed, location] = onConfirm.mock.calls[0]
    expect(location).toBe('pantry')
    expect(confirmed.map(i => i.name)).toEqual(['Rice'])
    expect(confirmed[0]).toMatchObject({ qty: 2, unit: 'bags', category: 'Dry Goods' })
  })

  it('the stepper and the inline editor change what gets confirmed', async () => {
    const { onConfirm } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'More Rice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Rice' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jasmine rice' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Pasta' } })
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Orzo' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add 2 to Pantry' })) })
    const [confirmed] = onConfirm.mock.calls[0]
    expect(confirmed[0]).toMatchObject({ name: 'Jasmine rice', qty: 3, category: 'Pasta', subcategory: 'Orzo', unit: 'boxes' })
  })

  it('with nothing selected the confirm is disabled', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Rice' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Black beans' }))
    expect(screen.getByRole('button', { name: 'Add 0 to Pantry' })).toBeDisabled()
  })

  it('Discard and the backdrop both cancel', () => {
    const { onCancel, onConfirm } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('after a partial failure only the failed rows remain, so Add retries just those', async () => {
    const onConfirm = vi.fn(async (rows) => ({ saved: rows.slice(1), failed: rows.slice(0, 1) }))
    renderSheet({ onConfirm })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add 2 to Pantry' })) })
    expect(screen.getByRole('alert')).toHaveTextContent('Rice')
    expect(screen.queryByText('Black beans')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add 1 to Pantry' })).toBeInTheDocument()
  })
})
