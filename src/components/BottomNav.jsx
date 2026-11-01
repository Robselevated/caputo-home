import { useLayoutEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ShoppingCart, Refrigerator, CalendarDays, BookOpen, Heart } from 'lucide-react'
import { LOCATIONS, LOCATION_LABELS, locationFromPath, locationTheme } from '../features/kitchen/locationTheme'
import { SegmentedControl } from './ui/SegmentedControl'

export const isKitchenPath = (p) => /^\/(kitchen|fridge|freezer|pantry)(\/|$)/.test(p)

// Segment labels use the location ink, not the accent: the pantry amber is a
// graphics colour and fails text contrast on white.
const SEGMENTS = LOCATIONS.map(l => ({ value: l, label: LOCATION_LABELS[l], activeClass: locationTheme(l).ink }))

// Height the Kitchen's location row adds to the bar (pt-2 + the 48px control).
// Published as --nav-extra so the page padding and toasts clear it too.
const KITCHEN_ROW = '3.5rem'

const TABS = [
  { to: '/grocery', label: 'Grocery', Icon: ShoppingCart, match: (p) => p.startsWith('/grocery'), active: () => 'text-accent-grocery' },
  { to: '/kitchen', label: 'Kitchen', Icon: Refrigerator, match: isKitchenPath, active: (p) => locationTheme(locationFromPath(p)).ink },
  { to: '/planning', label: 'Planning', Icon: CalendarDays, match: (p) => p.startsWith('/planning'), active: () => 'text-accent-planning' },
  { to: '/cookbook', label: 'Cookbook', Icon: BookOpen, match: (p) => p.startsWith('/cookbook'), active: () => 'text-accent-cookbook' },
  { to: '/date-night', label: 'Date Night', Icon: Heart, match: (p) => p.startsWith('/date-night'), active: () => 'text-accent-datenight' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const kitchen = isKitchenPath(pathname)

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--nav-extra', kitchen ? KITCHEN_ROW : '0px')
  }, [kitchen])

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-surface">
      {kitchen && (
        <div className="mx-auto max-w-md px-4 pt-2">
          <SegmentedControl label="Location" options={SEGMENTS} value={locationFromPath(pathname)} onChange={(loc) => navigate(`/kitchen/${loc}`)} />
        </div>
      )}
      <div className="mx-auto grid max-w-md grid-cols-5 gap-0.5 px-2 pt-2 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)]">
        {TABS.map(({ to, label, Icon, match, active }) => {
          const isActive = match(pathname)
          return (
            <Link
              key={to}
              to={to}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-[3px] whitespace-nowrap rounded-sm2 py-1 text-[11px] transition-colors ${
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
