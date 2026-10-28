import { MapPin } from 'lucide-react'
import { mapsLink } from './placesSearch'

// One restaurant inside the Date Night tile. The name opens the detail page
// and, on the list, is also the press-and-hold drag activator; the pin opens
// the Google profile. `sortable` carries the dnd-kit bindings or is null.
export function RestaurantRow({ restaurant, average, onOpen, sortable }) {
  const meta = [restaurant.cuisine, average != null ? `${average.toFixed(1)} / 10` : null].filter(Boolean).join(' · ')
  return (
    <div ref={sortable?.setNodeRef} style={sortable?.style} className="flex items-center gap-2 rounded-row bg-surface py-2 pl-3 pr-1.5">
      <button
        type="button"
        aria-label={`Open ${restaurant.name}`}
        onClick={() => onOpen(restaurant)}
        {...(sortable?.listeners ?? {})}
        className="flex min-w-0 flex-1 flex-col items-start gap-px py-1 text-left touch-manipulation"
      >
        <span className="w-full truncate text-base font-semibold text-ink">{restaurant.name}</span>
        {meta && <span className="w-full truncate text-[13px] text-ink-2">{meta}</span>}
      </button>
      <a
        href={mapsLink(restaurant)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${restaurant.name} in Google Maps`}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-datenight-tile text-datenight-ink active:opacity-80"
      >
        <MapPin size={20} aria-hidden="true" />
      </a>
    </div>
  )
}
