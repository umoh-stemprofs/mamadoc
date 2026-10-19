// Pure display helpers — parse "YYYY-MM-DD" as a calendar date (never via
// the machine clock) and format timestamps in APP_TZ at the edge.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function utc(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** "Mon 19 Oct" (design.md §6 date format). */
export function formatShortDate(isoDate: string): string {
  const date = utc(isoDate)
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

/** "Mon" — for weekday labels. */
export function weekdayShort(isoDate: string): string {
  return WEEKDAYS[utc(isoDate).getUTCDay()]
}

/** "19 Oct" — compact day label for week cards. */
export function formatDayMonth(isoDate: string): string {
  const date = utc(isoDate)
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

/** A stored timestamp rendered in APP_TZ: "19 Oct, 11:30". */
export function formatTimestamp(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')} ${get('month')}, ${get('hour')}:${get('minute')}`
}
