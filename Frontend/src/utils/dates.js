import { format, formatDistanceToNow, isYesterday } from 'date-fns'

/**
 * Parse datetime strings from the API. The backend stores UTC but serializes
 * naive ISO strings without a timezone suffix, which browsers treat as local time.
 */
export function parseApiDate(value) {
  if (!value) return new Date()
  const s = String(value)
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s)
  }
  return new Date(`${s}Z`)
}

export function formatRelativeTime(value, options = {}) {
  if (!value) return ''
  return formatDistanceToNow(parseApiDate(value), { addSuffix: true, ...options })
}

/** How often to refresh a relative label based on how old the timestamp is. */
export function relativeTimeTickInterval(value) {
  const ms = Date.now() - parseApiDate(value).getTime()
  if (ms < 60_000) return 5_000
  if (ms < 3_600_000) return 30_000
  if (ms < 86_400_000) return 60_000
  return 300_000
}

export function formatMessageTimestamp(value, now = new Date()) {
  if (!value) return ''
  const date = parseApiDate(value)
  const diffMs = now.getTime() - date.getTime()

  if (diffMs < 86_400_000) {
    return formatDistanceToNow(date, { addSuffix: true })
  }
  if (isYesterday(date)) {
    return `Yesterday ${format(date, 'h:mm a')}`
  }
  if (diffMs < 7 * 86_400_000) {
    return format(date, 'EEEE h:mm a')
  }
  return format(date, 'd MMM yyyy, h:mm a')
}

export function messageTimestampTickInterval(value) {
  const ms = Date.now() - parseApiDate(value).getTime()
  if (ms < 86_400_000) return relativeTimeTickInterval(value)
  return null
}
