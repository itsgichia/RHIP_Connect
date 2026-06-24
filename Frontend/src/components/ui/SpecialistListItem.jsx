import { Link } from 'react-router-dom'
import { ChevronRightIcon, PhoneIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { parseProfileName } from '../../utils/profile'

export default function SpecialistListItem({ specialist }) {
  const { honorific, displayName } = parseProfileName(specialist.name)

  return (
    <Link
      to={`/community/specialists/${specialist.slug}`}
      className="group block bg-white border border-gray-100 rounded-xl p-5 md:p-6 hover:border-rhip-teal/30 hover:shadow-md transition-all"
    >
      <div className="flex gap-4 md:gap-6">
        <div className="shrink-0 w-14 h-14 md:w-16 md:h-16 bg-rhip-lightTeal rounded-full flex items-center justify-center">
          <span className="text-rhip-teal font-semibold text-lg">
            {displayName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1">
            {honorific && (
              <span className="text-xs font-medium uppercase tracking-wide text-rhip-muted">
                {honorific}
              </span>
            )}
            <h3 className="font-display text-xl font-semibold text-rhip-dark group-hover:text-rhip-teal transition-colors">
              {displayName}
            </h3>
          </div>

          <p className="text-sm text-rhip-body mb-1">{specialist.title}</p>
          {specialist.department && (
            <p className="text-sm text-rhip-muted mb-3">{specialist.department}</p>
          )}

          <div className="flex flex-wrap gap-1.5 mb-3">
            {(specialist.specialties || []).map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 bg-rhip-dark text-white text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-xs text-rhip-muted">
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
              {specialist.facility_name}
            </span>
            {specialist.phone && (
              <span className="inline-flex items-center gap-1">
                <PhoneIcon className="w-3.5 h-3.5 shrink-0" />
                {specialist.phone}
              </span>
            )}
          </div>
        </div>

        <div className="hidden md:flex shrink-0 items-center">
          <ChevronRightIcon className="w-5 h-5 text-rhip-muted group-hover:text-rhip-teal transition-colors" />
        </div>
      </div>
    </Link>
  )
}
