import { useState } from 'react'

export default function ScanReview({ items, onConfirm, onCancel, location }) {
  const [editableItems, setEditableItems] = useState(
    items.map(item => ({ ...item, included: true }))
  )

  const updateItem = (index, field, value) => {
    setEditableItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold">Review Scan Results</h2>
          <button onClick={() => onCancel()} className="text-gray-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
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
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleItem(i)}
                  className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                    item.included ? 'bg-green-500 border-green-500' : 'border-gray-300'
                  }`}
                >
                  {item.included && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(i, 'name', e.target.value)}
                    className="w-full font-medium text-sm border-b border-gray-200 pb-1 focus:outline-none focus:border-green-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={item.qty || ''}
                      onChange={(e) => updateItem(i, 'qty', Number(e.target.value))}
                      className="w-16 text-sm border rounded px-2 py-1"
                      placeholder="Qty"
                      inputMode="decimal"
                    />
                    <input
                      type="text"
                      value={item.unit || ''}
                      onChange={(e) => updateItem(i, 'unit', e.target.value)}
                      className="w-20 text-sm border rounded px-2 py-1"
                      placeholder="Unit"
                    />
                    <span className="text-xs text-gray-400 self-center">
                      {item.category}{item.subcategory ? ` / ${item.subcategory}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex gap-3">
          <button
            onClick={() => onCancel()}
            className="flex-1 py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 text-sm font-medium text-white bg-green-500 rounded-xl"
          >
            Confirm {editableItems.filter(i => i.included).length} Items
          </button>
        </div>
      </div>
    </div>
  )
}
