import { Link } from 'react-router-dom'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { parseProfileName } from '../../utils/profile'

export default function ProfileListItem({ profile }) {
  const { honorific, displayName } = parseProfileName(profile.name)

  return (
    <Link
      to={`/directory/${profile.id}`}
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

          <p className="text-sm text-rhip-body mb-0.5">{profile.title}</p>
          {profile.institution_name && (
            <p className="text-sm text-rhip-muted mb-3">{profile.institution_name}</p>
          )}

          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="px-2.5 py-0.5 bg-rhip-dark text-white text-xs rounded-full">
              {profile.specialty_area}
            </span>
            {(profile.expertise_tags || []).slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 bg-rhip-cardBg text-rhip-body text-xs rounded-full border border-gray-100"
              >
                {tag}
              </span>
            ))}
            {(profile.expertise_tags || []).length > 5 && (
              <span className="px-2 py-0.5 text-xs text-rhip-muted">
                +{profile.expertise_tags.length - 5} more
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-rhip-muted">
            <span>{profile.publications} publications</span>
            <span>{profile.active_projects} active projects</span>
          </div>
        </div>

        <div className="hidden md:flex shrink-0 items-center">
          <ChevronRightIcon className="w-5 h-5 text-rhip-muted group-hover:text-rhip-teal transition-colors" />
        </div>
      </div>
    </Link>
  )
}
