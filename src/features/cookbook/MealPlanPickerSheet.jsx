import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { DEFAULT_SECTIONS } from '../../lib/mealSections'

// Pick whose list on the Planning tab this recipe goes under.
export function MealPlanPickerSheet({ open, recipeName, onClose, onPick }) {
  const [busy, setBusy] = useState(false)

  const pick = async (section) => {
    setBusy(true)
    await onPick(section)
    setBusy(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add to plan">
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-sm text-ink-2">Whose picks should {recipeName} go under?</p>
        <div className="flex flex-col gap-1.5 rounded-tile bg-control p-2.5">
          {DEFAULT_SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              disabled={busy}
              onClick={() => pick(section)}
              className="flex h-12 items-center justify-between rounded-row bg-surface px-4 text-left text-base font-semibold text-ink active:opacity-80 disabled:opacity-40"
            >
              {section}
              <CalendarPlus size={20} aria-hidden="true" className="text-accent-planning" />
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
