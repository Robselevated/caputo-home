import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { createFakeSupabase } = await import('../../test/fakeSupabase')
  return { supabase: createFakeSupabase() }
})
vi.mock('../../lib/authFetch', () => ({ authFetch: vi.fn() }))
vi.mock('../../components/ui/Toast', () => { const toast = vi.fn(() => 1); toast.dismiss = vi.fn(); return { toast } })

import { authFetch } from '../../lib/authFetch'
import { toast } from '../../components/ui/Toast'
import PasteTextForm from './PasteTextForm'

const LIST = `2 cups flour
1 tsp salt
3 eggs`

const PROSE = `Grandma's pancakes
Whisk two cups of flour with a teaspoon of salt, beat in three eggs and enough milk to loosen it, then cook on a hot griddle.`

function setup(props = {}) {
  const onParsed = vi.fn()
  const onLocalList = vi.fn()
  render(<PasteTextForm onParsed={onParsed} onLocalList={onLocalList} {...props} />)
  const box = screen.getByRole('textbox', { name: 'Recipe text' })
  const button = screen.getByRole('button', { name: 'Read this text' })
  return { onParsed, onLocalList, box, button }
}

beforeEach(() => vi.clearAllMocks())

describe('PasteTextForm', () => {
  it('renders the textarea, the hint and a button that stays disabled while empty', () => {
    const { box, button } = setup()
    expect(box).toHaveAttribute('placeholder', 'Paste the whole recipe, or just the ingredient list')
    expect(box).toHaveAttribute('rows', '8')
    expect(screen.getByText(/A plain ingredient list fills in instantly/)).toBeInTheDocument()
    expect(button).toBeDisabled()
    fireEvent.change(box, { target: { value: '   ' } })
    expect(button).toBeDisabled()
    fireEvent.change(box, { target: { value: LIST } })
    expect(button).toBeEnabled()
  })

  it('a plain list fills the rows locally with no request', async () => {
    const { onParsed, onLocalList, box, button } = setup()
    fireEvent.change(box, { target: { value: LIST } })
    await act(async () => { fireEvent.click(button) })
    expect(onLocalList).toHaveBeenCalledTimes(1)
    expect(onLocalList.mock.calls[0][0]).toEqual({
      ingredients: [
        { name: 'flour', qty: '2', unit: 'cups', notes: '', section: '' },
        { name: 'salt', qty: '1', unit: 'tsp', notes: '', section: '' },
        { name: 'eggs', qty: '3', unit: '', notes: '', section: '' },
      ],
    })
    expect(authFetch).not.toHaveBeenCalled()
    expect(onParsed).not.toHaveBeenCalled()
    expect(box).toHaveValue('')
  })

  it('prose makes exactly one request and hands the parsed recipe to onParsed', async () => {
    const parsed = { name: 'Pancakes', via: 'text', ingredients: [{ section: null, name: 'flour', qty: 2, qty_text: '2', unit: 'cup', notes: null }] }
    authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => parsed })
    const { onParsed, onLocalList, box, button } = setup()
    fireEvent.change(box, { target: { value: PROSE } })
    await act(async () => { fireEvent.click(button) })
    expect(authFetch).toHaveBeenCalledTimes(1)
    const [url, init] = authFetch.mock.calls[0]
    expect(url).toBe('/.netlify/functions/parse-recipe-text')
    expect(JSON.parse(init.body)).toEqual({ text: PROSE })
    expect(onParsed).toHaveBeenCalledWith(parsed)
    expect(onLocalList).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    expect(box).toHaveValue('')
  })

  it('an error reply shows a toast, keeps the text and calls neither callback', async () => {
    authFetch.mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: 'No ingredients found there.' }) })
    const { onParsed, onLocalList, box, button } = setup()
    fireEvent.change(box, { target: { value: PROSE } })
    await act(async () => { fireEvent.click(button) })
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0][0]).toMatchObject({ message: 'No ingredients found there.', tone: 'error' })
    expect(onParsed).not.toHaveBeenCalled()
    expect(onLocalList).not.toHaveBeenCalled()
    expect(box).toHaveValue(PROSE)
  })

  it('the button is disabled while the parent says busy', () => {
    const { box, button } = setup({ busy: true })
    fireEvent.change(box, { target: { value: LIST } })
    expect(button).toBeDisabled()
  })
})
