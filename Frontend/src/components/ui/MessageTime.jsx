import { useMessageTimestamp } from '../../hooks/useRelativeTime'

export default function MessageTime({ value, className }) {
  const label = useMessageTimestamp(value)
  if (!value || !label) return null
  return <span className={className}>{label}</span>
}
