import { formatDistanceToNowStrict, parseISO } from 'date-fns'

export const APP_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE || 'Asia/Tokyo'

// Japan Standard Time has no daylight-saving changes.
export function fromTokyoInput(value: string) {
  return new Date(`${value.length === 10 ? `${value}T00:00` : value}+09:00`).toISOString()
}

export function formatDate(iso: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    ...(options ?? { month: 'short', day: 'numeric', year: 'numeric' }),
  }).format(new Date(iso))
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string) {
  return `${formatDate(iso)} · ${formatTime(iso)}`
}

export function relativeTime(iso: string) {
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })
}

export function sameDay(a: string, b: string) {
  return dateKeyInTimeZone(a) === dateKeyInTimeZone(b)
}

export function dateKeyInTimeZone(iso: string, timeZone = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function toInputDateTime(iso: string, timeZone = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`
}

export function toDateInput(iso: string, timeZone = APP_TIMEZONE) {
  return dateKeyInTimeZone(iso, timeZone)
}
