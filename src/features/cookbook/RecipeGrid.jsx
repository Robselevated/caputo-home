import { RecipeCard } from './RecipeCard'

export function RecipeGrid({ recipes, coverage, refreshingId, onOpen, onRefresh }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          coverage={coverage[recipe.id]}
          refreshing={refreshingId === recipe.id}
          onOpen={onOpen}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  )
}

// First paint with nothing cached: card-shaped placeholders, never a spinner.
export function GridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 animate-pulse" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="aspect-[4/3] rounded-tile bg-control" />
          <div className="h-4 w-3/4 rounded bg-control" />
          <div className="h-3 w-1/2 rounded bg-control" />
        </div>
      ))}
    </div>
  )
}
