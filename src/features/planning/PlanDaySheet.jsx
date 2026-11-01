import { BookOpen, ShoppingCart, Undo2, Trash2, Plus } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { resolveSection } from '../../lib/mealSections'
import { cookName } from './WeekPlan'

export const dayTitle = (date) => date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

function ChoosePick({ waiting, onSchedule, onSomethingElse }) {
  const groups = [...waiting.entries()].filter(([, list]) => list.length > 0)
  return (
    <div className="flex flex-col gap-4 pb-2">
      {groups.length === 0 ? (
        <p className="text-[15px] text-ink-2">No picks waiting. Add one below, from the cookbook or as a quick idea.</p>
      ) : (
        groups.map(([section, list]) => (
          <div key={section} className="flex flex-col gap-1.5">
            <h3 className="px-1 text-[13px] font-semibold text-ink-2">{section}</h3>
            <ul className="flex flex-col gap-1.5">
              {list.map(pick => (
                <li key={pick.id}>
                  <button
                    type="button"
                    aria-label={`Plan ${pick.name}`}
                    onClick={() => onSchedule(pick)}
                    className="flex w-full items-center gap-3 rounded-row bg-control py-2 pl-3 pr-2 text-left active:opacity-80"
                  >
                    {pick.image_url ? (
                      <img src={pick.image_url} alt="" className="h-10 w-10 shrink-0 rounded-sm2 object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm2 bg-track">
                        <BookOpen size={18} aria-hidden="true" className="text-ink-3" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{pick.name}</span>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-planning text-white">
                      <Plus size={20} strokeWidth={2.2} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <Button variant="secondary" onClick={onSomethingElse}>Something else</Button>
    </div>
  )
}

function PlannedMeal({ pick, busy, onOpenRecipe, onShop, onUnschedule, onRemove }) {
  const hasRecipe = !!pick.recipe_id
  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-center gap-3">
        {pick.image_url && <img src={pick.image_url} alt="" className="h-14 w-14 shrink-0 rounded-sm2 object-cover" />}
        <div className="flex min-w-0 flex-col gap-px">
          <p className="truncate text-lg font-bold text-ink">{pick.name}</p>
          <p className="text-[14px] text-ink-2">{cookName(pick)} is cooking</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {hasRecipe && (
          <Button variant="secondary" onClick={() => onOpenRecipe(pick)}>
            <BookOpen size={18} aria-hidden="true" />Open recipe
          </Button>
        )}
        {hasRecipe && (
          <Button variant="secondary" disabled={busy} onClick={() => onShop(pick)}>
            <ShoppingCart size={18} aria-hidden="true" />{busy ? 'Checking the kitchen' : 'Shop missing ingredients'}
          </Button>
        )}
        <Button variant="secondary" onClick={() => onUnschedule(pick)}>
          <Undo2 size={18} aria-hidden="true" />Back to {resolveSection(pick.section)}
        </Button>
        <Button variant="danger" onClick={() => onRemove(pick)}>
          <Trash2 size={18} aria-hidden="true" />Remove from the plan
        </Button>
      </div>
    </div>
  )
}

// One calendar day: choose a waiting pick for an empty day, or act on the
// meal already there.
export function PlanDaySheet({ day, pick, waiting, busy, onClose, onSchedule, onSomethingElse, onOpenRecipe, onShop, onUnschedule, onRemove }) {
  return (
    <Sheet open={!!day} onClose={onClose} title={day ? dayTitle(day.date) : ''}>
      {day && (pick ? (
        <PlannedMeal pick={pick} busy={busy} onOpenRecipe={onOpenRecipe} onShop={onShop} onUnschedule={onUnschedule} onRemove={onRemove} />
      ) : (
        <ChoosePick waiting={waiting} onSchedule={onSchedule} onSomethingElse={onSomethingElse} />
      ))}
    </Sheet>
  )
}
