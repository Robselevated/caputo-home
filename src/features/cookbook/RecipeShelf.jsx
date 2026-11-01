import { RecipeCard } from './RecipeCard'

// Cards that fit on screen before swiping load eagerly.
const EAGER_CARDS = 3

// One swipe row: a heading and a sideways-scrolling run of recipe cards that
// snaps card by card and bleeds to the screen edges.
export function RecipeShelf({ title, recipes, coverage, refreshingId, onOpen, onRefresh }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="flex items-baseline justify-between gap-2 font-heading text-[17px] font-bold text-ink">
        {title}
        <span className="text-[13px] font-semibold text-ink-2">{recipes.length}</span>
      </h2>
      <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
        {recipes.map((recipe, i) => (
          <div key={recipe.id} className="w-[44%] shrink-0 snap-start">
            <RecipeCard
              recipe={recipe}
              coverage={coverage[recipe.id]}
              refreshing={refreshingId === recipe.id}
              eager={i < EAGER_CARDS}
              onOpen={onOpen}
              onRefresh={onRefresh}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
