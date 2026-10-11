import { Fragment } from 'react'
import { Tile } from '../../components/ui/Tile'
import { groupBySection, ingredientDetail, splitSteps } from './recipeFormat'

// Ingredients as white rows inside the pantry-amber tile, grouped by section.
// `missingNames` (lowercased) marks what the kitchen does not have.
export function IngredientsTile({ ingredients = [], missingNames }) {
  const groups = groupBySection(ingredients)
  return (
    <Tile tileClass="bg-loc-pantry-tile" inkClass="text-loc-pantry-ink" heading="Ingredients" count={ingredients.length || ''}>
      {ingredients.length === 0 ? (
        <p className="px-1.5 pb-1 text-[13px] text-loc-pantry-ink">No ingredients listed</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {groups.map((group, gi) => (
            <Fragment key={gi}>
              {group.name && <p className="px-1.5 pt-1 text-[12px] font-semibold text-loc-pantry-ink">{group.name}</p>}
              {group.items.map((ing, i) => {
                const detail = ingredientDetail(ing)
                const missing = missingNames?.has(String(ing.name || '').toLowerCase())
                return (
                  <div key={ing.id ?? `${gi}-${i}`} className="flex items-center gap-2 rounded-row bg-surface py-2 pl-3 pr-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-px py-1">
                      <span className="truncate text-base font-semibold text-ink">{ing.name}</span>
                      {detail && <span className="truncate text-[13px] text-ink-2">{detail}</span>}
                    </div>
                    {missing && <span className="shrink-0 rounded-full bg-danger-tile px-2 py-0.5 text-[11px] font-bold text-danger-ink">Need</span>}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      )}
    </Tile>
  )
}

// Numbered steps: a real sequence, so an ordered list with its markers.
export function StepsCard({ instructions }) {
  const steps = splitSteps(instructions)
  if (steps.length === 0) return null
  return (
    <section className="flex flex-col gap-3 rounded-tile bg-surface p-4 shadow-soft">
      <h2 className="font-heading text-[17px] font-bold text-ink">Steps</h2>
      <ol aria-label="Steps" className="flex list-decimal flex-col gap-2.5 pl-6 text-[15px] leading-relaxed text-ink marker:font-bold marker:text-accent-cookbook">
        {steps.map((step, i) => <li key={i}>{step}</li>)}
      </ol>
    </section>
  )
}
