import { useEffect, useState } from 'react'
import {
  formatMessageTimestamp,
  formatRelativeTime,
  messageTimestampTickInterval,
  relativeTimeTickInterval,
} from '../utils/dates'

function useTimedLabel(value, formatFn, getInterval) {
  const [label, setLabel] = useState(() => (value ? formatFn(value) : ''))

  useEffect(() => {
    if (!value) {
      setLabel('')
      return undefined
    }

    const update = () => setLabel(formatFn(value))
    update()

    let timer
    const schedule = () => {
      const interval = getInterval(value)
      if (!interval) return
      timer = setTimeout(() => {
        update()
        schedule()
      }, interval)
    }
    schedule()

    return () => clearTimeout(timer)
  }, [value, formatFn, getInterval])

  return label
}

export function useRelativeTime(value) {
  return useTimedLabel(value, formatRelativeTime, relativeTimeTickInterval)
}

export function useMessageTimestamp(value) {
  return useTimedLabel(value, formatMessageTimestamp, messageTimestampTickInterval)
}
