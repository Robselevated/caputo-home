// Week helpers for the Planning calendar. Days are local calendar dates kept
// as 'YYYY-MM-DD' strings (what a Postgres `date` column returns); never built
// with toISOString, which would shift the day in the evening west of UTC.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

// Monday of the week holding `date`, at local midnight.
export function startOfWeek(date) {
  const offset = (date.getDay() + 6) % 7
  return addDays(date, -offset)
}

export function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function weekDays(start) {
  return DAY_NAMES.map((name, i) => {
    const date = addDays(start, i)
    return { name, date, key: toDateKey(date) }
  })
}

// "Nov 2–8", or "Oct 26 – Nov 1" across a month.
export function weekRange(start) {
  const end = addDays(start, 6)
  const a = `${MONTHS[start.getMonth()]} ${start.getDate()}`
  return start.getMonth() === end.getMonth()
    ? `${a}–${end.getDate()}`
    : `${a} – ${MONTHS[end.getMonth()]} ${end.getDate()}`
}

export function weekLabel(start, today = new Date()) {
  const diff = Math.round((startOfWeek(start) - startOfWeek(today)) / (7 * 86400000))
  const range = weekRange(start)
  if (diff === 0) return `This week · ${range}`
  if (diff === 1) return `Next week · ${range}`
  if (diff === -1) return `Last week · ${range}`
  return range
}
