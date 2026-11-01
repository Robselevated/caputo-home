import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton'
import { addDays, startOfWeek, toDateKey, weekDays, weekLabel } from '../../lib/week'
import { resolveSection } from '../../lib/mealSections'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Who's cooking, from the list the pick came from.
export function cookName(pick) {
  return resolveSection(pick.section).startsWith('Rob') ? 'Rob' : 'Chey'
}

function CookPill({ pick }) {
  const who = cookName(pick)
  const tone = who === 'Rob' ? 'bg-accent-planning text-white' : 'bg-accent-planning/15 text-accent-planning'
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${tone}`}>{who}</span>
}

function DayRow({ day, pick, isToday, isPast, onOpen }) {
  const dayText = `${day.name} ${MONTHS[day.date.getMonth()]} ${day.date.getDate()}`
  return (
    <button
      type="button"
      aria-label={pick ? `${dayText}: ${pick.name}, ${cookName(pick)} cooking` : `Plan a meal for ${dayText}`}
      aria-current={isToday ? 'date' : undefined}
      onClick={() => onOpen(day)}
      className={`flex min-h-[56px] w-full items-center gap-3 rounded-row bg-surface py-2 pl-2 pr-2.5 text-left active:opacity-80 ${isPast && !isToday ? 'opacity-60' : ''}`}
    >
      <span className="flex w-11 shrink-0 flex-col items-center leading-tight">
        <span className={`text-[11px] font-bold uppercase tracking-wide ${isToday ? 'text-accent-planning' : 'text-ink-2'}`}>{day.name}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-bold ${isToday ? 'bg-accent-planning text-white' : 'text-ink'}`}>
          {day.date.getDate()}
        </span>
      </span>
      {pick ? (
        <>
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{pick.name}</span>
          <CookPill pick={pick} />
        </>
      ) : (
        <span className="flex flex-1 items-center gap-1.5 text-[15px] font-medium text-ink-3">
          <Plus size={18} strokeWidth={2.2} aria-hidden="true" className="text-accent-planning" />
          Plan a meal
        </span>
      )}
    </button>
  )
}

// Seven day rows, Monday to Sunday, for the week the arrows land on. Starts on
// the week holding today. `planned` maps 'YYYY-MM-DD' to that day's pick.
export function WeekPlan({ planned, onOpenDay }) {
  const today = new Date()
  const todayKey = toDateKey(today)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const label = weekLabel(weekStart, today)

  return (
    <section aria-label="Week plan" className="flex flex-col gap-1.5 rounded-tile bg-control p-2.5">
      <div className="flex min-h-[36px] items-center gap-1 pb-1 pt-0.5">
        <IconButton label="Previous week" onClick={() => setWeekStart(w => addDays(w, -7))}>
          <ChevronLeft size={22} aria-hidden="true" className="text-accent-planning" />
        </IconButton>
        <h2 className="min-w-0 flex-1 truncate text-center font-heading text-[17px] font-bold text-accent-planning">{label}</h2>
        <IconButton label="Next week" onClick={() => setWeekStart(w => addDays(w, 7))}>
          <ChevronRight size={22} aria-hidden="true" className="text-accent-planning" />
        </IconButton>
      </div>
      <div className="flex flex-col gap-1.5">
        {days.map(day => (
          <DayRow
            key={day.key}
            day={day}
            pick={planned.get(day.key)}
            isToday={day.key === todayKey}
            isPast={day.key < todayKey}
            onOpen={onOpenDay}
          />
        ))}
      </div>
    </section>
  )
}
