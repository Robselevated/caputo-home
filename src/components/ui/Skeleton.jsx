// Placeholder tiles for the first paint before any cached data exists.
export function TileSkeleton({ rows = 3 }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-tile bg-control p-2.5" aria-hidden="true">
      <div className="mx-1.5 my-2 h-4 w-24 rounded bg-track" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-row bg-surface/70" />
      ))}
    </div>
  )
}

export function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <TileSkeleton rows={3} />
      <TileSkeleton rows={2} />
    </div>
  )
}
