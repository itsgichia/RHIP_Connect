export function indicativeBandLabel(band) {
  if (band === 'strong') return 'Strong outlook'
  if (band === 'promising') return 'Promising'
  return 'Developing'
}

export function indicativeBandClass(band) {
  if (band === 'strong') return 'bg-rhip-teal text-white'
  if (band === 'promising') return 'bg-rhip-seafoam text-white'
  return 'bg-rhip-cardBg text-rhip-body'
}

export function formatIllustrativeMultiple(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(1)}×`
}
