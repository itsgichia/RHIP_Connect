export const TRL_LABELS = {
  1: 'Basic principles observed',
  2: 'Technology concept formulated',
  3: 'Experimental proof of concept',
  4: 'Technology validated in lab',
  5: 'Technology validated in relevant environment',
  6: 'Technology demonstrated in relevant environment',
  7: 'System prototype demonstrated in operational environment',
  8: 'System complete and qualified',
  9: 'Actual system proven in operational environment',
}

/** RAG badge colours: red = early, amber = middle, green = TRL 7+. */
export const TRL_COLORS = {
  1: 'bg-red-50 text-red-700',
  2: 'bg-red-50 text-red-700',
  3: 'bg-red-50 text-red-700',
  4: 'bg-amber-50 text-amber-800',
  5: 'bg-amber-50 text-amber-800',
  6: 'bg-amber-50 text-amber-800',
  7: 'bg-emerald-50 text-emerald-800',
  8: 'bg-emerald-50 text-emerald-800',
  9: 'bg-emerald-50 text-emerald-800',
}

/** Investor-facing maturity bands — plain language first, TRL as secondary detail. */
export const TRL_FILTERS = [
  {
    key: 'all',
    label: 'All stages',
    description: 'Every investable project',
    min: null,
    max: null,
  },
  {
    key: '4-5',
    label: 'Early validation',
    description: 'Validated in the lab or a relevant clinical setting',
    trlRange: 'TRL 4–5',
    min: 4,
    max: 5,
  },
  {
    key: '6-7',
    label: 'Clinical demonstration',
    description: 'Demonstrated in real-world healthcare environments',
    trlRange: 'TRL 6–7',
    min: 6,
    max: 7,
  },
  {
    key: '8-9',
    label: 'Market ready',
    description: 'Complete, qualified, and proven in live use',
    trlRange: 'TRL 8–9',
    min: 8,
    max: 9,
  },
]

export function trlStageBand(trl) {
  return TRL_FILTERS.find((item) => item.min && trl >= item.min && trl <= item.max) || null
}

export function trlStageBandLabel(trl) {
  return trlStageBand(trl)?.label || trlFullLabel(trl)
}

export function trlShortLabel(trl) {
  return `TRL ${trl}`
}

export function trlFullLabel(trl) {
  return TRL_LABELS[trl] || `Technology readiness level ${trl}`
}

export function trlBadgeClass(trl) {
  return TRL_COLORS[trl] || TRL_COLORS[4]
}

export function matchesTrlFilter(trl, filterKey) {
  const filter = TRL_FILTERS.find((item) => item.key === filterKey)
  if (!filter || filter.key === 'all') return true
  return trl >= filter.min && trl <= filter.max
}
