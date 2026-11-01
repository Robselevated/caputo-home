import { BookOpen, RefreshCw } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton'
import { Photo } from '../../components/ui/Photo'
import { coverageLabel, recipeMeta } from './recipeFormat'

// One grid card: photo, name, a meta line and the ingredient coverage pill.
// A linked recipe without a photo gets a refresh control to fetch one. The
// first rows load eagerly so coming back to the tab paints them at once.
export function RecipeCard({ recipe, coverage, refreshing, eager = false, photoSize = 480, onOpen, onRefresh }) {
  const meta = recipeMeta(recipe)
  const pill = coverageLabel(coverage)
  const complete = pill === 'Have it all'
  const placeholder = (
    <span className="flex aspect-[4/3] w-full items-center justify-center rounded-tile bg-control">
      <BookOpen size={28} strokeWidth={1.6} aria-hidden="true" className="text-ink-3" />
    </span>
  )
  const canRefresh = !!recipe.source_url && !recipe.image_url

  return (
    <div className="relative flex flex-col">
      <button type="button" onClick={() => onOpen(recipe)} className="flex flex-col gap-1.5 text-left active:opacity-80">
        <Photo src={recipe.image_url} size={photoSize} fallback={placeholder} alt="" loading={eager ? 'eager' : 'lazy'} width="400" height="300" className="aspect-[4/3] w-full rounded-tile bg-control object-cover" />
        <span className="line-clamp-2 px-0.5 font-heading text-[15px] font-bold leading-snug text-ink">{recipe.name}</span>
        {(meta || pill) && (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-0.5 text-[13px] text-ink-2">
            {meta && <span>{meta}</span>}
            {pill && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${complete ? 'bg-store-pilgrims-tile text-store-pilgrims-ink' : 'bg-control text-ink-2'}`}>{pill}</span>
            )}
          </span>
        )}
      </button>
      {canRefresh && (
        <IconButton label={`Fetch a photo for ${recipe.name}`} variant="outline" size={40} className="absolute right-2 top-2" disabled={refreshing} onClick={() => onRefresh(recipe)}>
          <RefreshCw size={18} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
        </IconButton>
      )}
    </div>
  )
}
