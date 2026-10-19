import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

// Slim back control above a sub-page header. Labelled with where it goes,
// not "Back", so the name reads right in a screen reader's button list.
export function BackLink({ to, onClick, label }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={onClick ?? (() => navigate(to))}
      className="-ml-2 flex h-10 items-center gap-1 self-start rounded-full px-2 text-[15px] font-semibold text-accent-cookbook active:bg-control"
    >
      <ArrowLeft size={20} aria-hidden="true" />
      {label}
    </button>
  )
}
