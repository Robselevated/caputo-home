import { useState } from 'react'

const LOCATION_LABELS = {
  pantry: 'Pantry',
  freezer: 'Freezer',
  fridge: 'Fridge',
  receipt: 'List',
}

export default function ScanReview({ items, onConfirm, onCancel, location }) {
  const [editableItems, setEditableItems] = useState(
    items.map(item => ({ ...item, qty: item.qty || 1, included: true }))
  )

  const updateItem = (index, field, value) => {
    setEditableItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const adjustQty = (index, delta) => {
    setEditableItems(prev => {
      const updated = [...prev]
      const newQty = Math.max(1, (updated[index].qty || 1) + delta)
      updated[index] = { ...updated[index], qty: newQty }
      return updated
    })
  }

  const toggleItem = (index) => {
    setEditableItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], included: !updated[index].included }
      return updated
    })
  }

  const handleConfirm = () => {
    const confirmed = editableItems.filter(i => i.included)
    onConfirm(confirmed, location)
  }

  const includedCount = editableItems.filter(i => i.included).length
  const label = LOCATION_LABELS[location] || 'List'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <button onClick={() => onCancel()} className="text-gray-400 text-sm font-medium">
            Cancel
          </button>
          <h2 className="text-base font-bold">Review Items</h2>
          <button
            onClick={handleConfirm}
            className="text-green-600 text-sm font-bold"
          >
            Add to {label}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {editableItems.map((item, i) => (
            <div
              key={i}
              className={`card ${!item.included ? 'opacity-40' : ''} ${
                item.needs_verification ? 'border-yellow-300 border-2' : ''
              }`}
            >
              {item.needs_verification && (
                <div className="flex items-center gap-1.5 text-yellow-600 text-xs font-medium mb-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  {item.verification_prompt || 'Low confidence. Please verify.'}
                </div>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleItem(i)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 ${
                    item.included ? 'bg-green-500 border-green-500' : 'border-gray-300'
                  }`}
                >
                  {item.included && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(i, 'name', e.target.value)}
                    className="w-full font-medium text-sm border-b border-gray-200 pb-0.5 focus:outline-none focus:border-green-500"
                  />
                  <span className="text-xs text-gray-400">
                    {item.category}{item.subcategory ? ` / ${item.subcategory}` : ''}
                    {item.unit ? ` · ${item.unit}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => adjustQty(i, -1)}
                    className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{item.qty || 1}</span>
                  <button
                    onClick={() => adjustQty(i, 1)}
                    className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={handleConfirm}
            className="w-full py-3 text-sm font-bold text-white bg-green-500 rounded-xl active:scale-[0.98] transition-transform"
          >
            Add {includedCount} Item{includedCount !== 1 ? 's' : ''} to {label}
          </button>
        </div>
      </div>
    </div>
  )
}
