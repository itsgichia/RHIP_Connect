const TIER_STYLES = {
  none: 'bg-gray-100 text-gray-500',
  bronze: 'bg-amber-100 text-amber-800',
  silver: 'bg-gray-200 text-gray-700',
  gold: 'bg-yellow-100 text-yellow-800',
}

export default function TierBadge({ tier, size = 'sm' }) {
  const label = tier === 'none' ? 'No tier' : tier.charAt(0).toUpperCase() + tier.slice(1)
  const sizeClass = size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-2 py-0.5 text-xs'

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${sizeClass} ${TIER_STYLES[tier] || TIER_STYLES.none}`}>
      {label}
    </span>
  )
}
