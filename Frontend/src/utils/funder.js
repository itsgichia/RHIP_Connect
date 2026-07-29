/** Funder badges and filters for ARC / MRFF competitive grants. */

export const FUNDER_FILTERS = [
  { key: 'all', label: 'All funders' },
  { key: 'arc', label: 'ARC' },
  { key: 'mrff', label: 'MRFF' },
]

export function funderLabel(funder) {
  if (!funder) return null
  const key = String(funder).toLowerCase()
  if (key === 'arc') return 'ARC'
  if (key === 'mrff') return 'MRFF'
  if (key === 'other') return 'Other'
  return String(funder).toUpperCase()
}

export function funderBadgeClass(funder) {
  const key = String(funder || '').toLowerCase()
  if (key === 'arc') return 'bg-rhip-navy/10 text-rhip-navy border border-rhip-navy/20'
  if (key === 'mrff') return 'bg-rhip-coral/10 text-rhip-coral border border-rhip-coral/25'
  if (key === 'other') return 'bg-gray-100 text-rhip-muted border border-gray-200'
  return 'bg-gray-100 text-rhip-muted border border-gray-200'
}

export function matchesFunderFilter(funder, filterKey) {
  if (!filterKey || filterKey === 'all') return true
  const key = funder ? String(funder).toLowerCase() : null
  if (filterKey === 'other') return !key || key === 'other'
  return key === filterKey
}

export function isCompetitiveGrant(project) {
  const key = project?.funder ? String(project.funder).toLowerCase() : ''
  return key === 'arc' || key === 'mrff'
}
