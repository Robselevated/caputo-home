import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Tile } from '../../components/ui/Tile'
import { LOCATION_LABELS, locationTheme } from '../kitchen/locationTheme'
import { ScanItemRow } from './ScanItemRow'
import { prepareItems, toConfirmed } from './scanItems'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// Review of a shelf scan before it lands in one kitchen location. Same props
// KitchenPage has always passed: onConfirm(items, location); onCancel discards.
export default function ScanReview({ items, onConfirm, onCancel, location }) {
  const theme = locationTheme(location)
  const label = LOCATION_LABELS[location] || 'Kitchen'
  const [rows, setRows] = useState(() => prepareItems(items, () => location))
  const [expandedId, setExpandedId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [failedNames, setFailedNames] = useState([])

  const patch = (id, changes) => setRows(prev => prev.map(r => (r._id === id ? { ...r, ...changes } : r)))
  const included = rows.filter(r => r.included)

  const confirm = async () => {
    setSaving(true)
    setFailedNames([])
    try {
      const pairs = included.map(row => [row, toConfirmed(row)])
      const result = await onConfirm(pairs.map(([, c]) => c), location)
      // The hook keeps the sheet open when something failed: show only those
      // rows so Add retries them instead of duplicating the ones that saved.
      const failed = result?.failed
      if (failed?.length) {
        const failedIds = new Set(pairs.filter(([, c]) => failed.includes(c)).map(([row]) => row._id))
        setFailedNames(included.filter(r => failedIds.has(r._id)).map(r => r.name))
        setRows(prev => prev.filter(r => failedIds.has(r._id)))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onCancel}
      title={`Found ${plural(rows.length, 'item')}`}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>Discard</Button>
          <Button className={`flex-1 ${theme.accentBg}`} onClick={confirm} disabled={saving || included.length === 0}>
            {saving ? `Adding ${included.length}` : `Add ${included.length} to ${label}`}
          </Button>
        </div>
      }
    >
      <p className="pb-3 text-sm text-ink-2">Tap a name to fix it, or uncheck what does not belong.</p>
      {failedNames.length > 0 && (
        <p role="alert" className="mb-3 rounded-row bg-danger-tile px-3 py-2 text-sm font-semibold text-danger-ink">
          Couldn't add {failedNames.join(', ')}. Tap Add to try again.
        </p>
      )}
      <Tile tileClass={theme.tile} inkClass={theme.ink} heading={label} count={included.length}>
        <div className="flex flex-col gap-1.5">
          {rows.map(row => (
            <ScanItemRow
              key={row._id}
              item={row}
              theme={theme}
              expanded={expandedId === row._id}
              onToggle={() => patch(row._id, { included: !row.included })}
              onExpand={() => setExpandedId(prev => (prev === row._id ? null : row._id))}
              onChange={(changes) => patch(row._id, changes)}
            />
          ))}
        </div>
      </Tile>
    </Sheet>
  )
}
