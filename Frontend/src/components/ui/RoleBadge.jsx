import { IDENTITY_FACET_LABELS, ROLE_LABELS, facetLabel } from '../../utils/roles'

const ROLE_STYLES = {
  clinician: 'bg-rhip-lightTeal text-rhip-teal',
  researcher: 'bg-indigo-50 text-indigo-700',
  professional_technical: 'bg-amber-50 text-amber-800',
  policy: 'bg-violet-50 text-violet-800',
  industry: 'bg-orange-50 text-orange-700',
  investor: 'bg-emerald-50 text-emerald-700',
  admin: 'bg-amber-50 text-amber-800',
}

export default function RoleBadge({ role, facets }) {
  const list = Array.isArray(facets) && facets.length > 0
    ? facets
    : role
      ? [role]
      : []

  if (list.length === 0) return null

  return (
    <span className="inline-flex flex-wrap gap-1">
      {list.map((item) => {
        const label = facetLabel(item) || IDENTITY_FACET_LABELS[item] || ROLE_LABELS[item] || item
        const style = ROLE_STYLES[item] || 'bg-slate-100 text-slate-600'
        return (
          <span
            key={item}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style}`}
          >
            {label}
          </span>
        )
      })}
    </span>
  )
}
