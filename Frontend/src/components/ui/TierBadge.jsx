const TIER_STYLES = {
  none: 'bg-slate-100 text-slate-500',
  bronze: 'bg-amber-50 text-amber-800',
  silver: 'bg-slate-200 text-slate-700',
  gold: 'bg-yellow-50 text-yellow-800',
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
