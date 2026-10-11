import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CategorySection from './CategorySection'

const rice = { id: 'a', name: 'Rice', category: 'Dry Goods', subcategory: null, qty: 0, unit: 'bags', notes: null }
const beans = { id: 'b', name: 'Beans', category: 'Dry Goods', subcategory: null, qty: 2, unit: 'cans', notes: null }

function renderSection(props = {}) {
  const onDelete = vi.fn()
  const onUpdateQty = vi.fn()
  render(
    <CategorySection
      category="Dry Goods"
      items={[rice, beans]}
      onUpdateQty={onUpdateQty}
      onEditItem={vi.fn()}
      onDelete={onDelete}
      onAddToGrocery={vi.fn()}
      userId="u1"
      location="pantry"
      {...props}
    />
  )
  // sections start collapsed in this phase
  fireEvent.click(screen.getByRole('button', { name: /Dry Goods/ }))
  return { onDelete, onUpdateQty }
}

describe('CategorySection delete affordances', () => {
  it('the trash button passes the whole item to onDelete (the undo toast needs the name)', () => {
    const { onDelete } = renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Beans' }))
    expect(onDelete).toHaveBeenCalledWith(beans)
  })

  it('an item at qty 0 shows a Remove button instead of leaving it stranded as "Out"', () => {
    const { onDelete } = renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Rice' }))
    expect(onDelete).toHaveBeenCalledWith(rice)
  })

  it('an item at qty 0 has no minus button (nothing below zero)', () => {
    renderSection()
    expect(screen.queryByRole('button', { name: 'Decrease Rice' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease Beans' })).toBeInTheDocument()
  })

  it('hidden items (pending delete) are not rendered', () => {
    renderSection({ hiddenIds: new Set(['b']) })
    expect(screen.queryByText('Beans')).not.toBeInTheDocument()
    expect(screen.getByText('Rice')).toBeInTheDocument()
  })
})
