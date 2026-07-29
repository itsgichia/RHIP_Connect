import { useRelativeTime } from '../../hooks/useRelativeTime'

export default function RelativeTime({ value, className }) {
  const label = useRelativeTime(value)
  if (!value || !label) return null
  return <span className={className}>{label}</span>
}
