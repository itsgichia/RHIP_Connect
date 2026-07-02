export function formatAud(amount) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDuration(months) {
  if (!months) return 'Recently started'
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years === 0) return `${rem} month${rem === 1 ? '' : 's'}`
  if (rem === 0) return `${years} year${years === 1 ? '' : 's'}`
  return `${years} yr${years === 1 ? '' : 's'} ${rem} mo`
}

export function formatStartDate(isoDate) {
  if (!isoDate) return null
  return new Date(isoDate).toLocaleDateString('en-AU', {
    month: 'short',
    year: 'numeric',
  })
}
