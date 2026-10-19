import { Link, useLocation } from 'react-router'
import { ShoppingCart, Refrigerator, CalendarDays, BookOpen } from 'lucide-react'
import { locationFromPath, locationTheme } from '../features/kitchen/locationTheme'

const TABS = [
  { to: '/grocery', label: 'Grocery', Icon: ShoppingCart, match: (p) => p.startsWith('/grocery'), active: () => 'text-accent-grocery' },
  { to: '/kitchen', label: 'Kitchen', Icon: Refrigerator, match: (p) => /^\/(kitchen|fridge|freezer|pantry)(\/|$)/.test(p), active: (p) => locationTheme(locationFromPath(p)).ink },
  { to: '/planning', label: 'Planning', Icon: CalendarDays, match: (p) => p.startsWith('/planning'), active: () => 'text-accent-planning' },
  { to: '/cookbook', label: 'Cookbook', Icon: BookOpen, match: (p) => p.startsWith('/cookbook'), active: () => 'text-accent-cookbook' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-surface">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1 px-3 pt-2 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)]">
        {TABS.map(({ to, label, Icon, match, active }) => {
          const isActive = match(pathname)
          return (
            <Link
              key={to}
              to={to}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-[3px] rounded-sm2 py-1 text-[11px] transition-colors ${
                isActive ? `font-semibold ${active(pathname)}` : 'font-medium text-ink-2'
              }`}
            >
              <Icon size={26} strokeWidth={isActive ? 2.2 : 2} aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
