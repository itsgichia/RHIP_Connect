import { Link, useLocation } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/community', label: 'Overview', exact: true },
  { to: '/community/services', label: 'Services' },
  { to: '/community/specialists', label: 'Our Specialists' },
]

export default function CommunityNav() {
  const { pathname } = useLocation()

  const isActive = (to, exact = false) =>
    exact ? pathname === to : pathname.startsWith(to)

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link to="/" className="text-rhip-muted hover:text-rhip-teal">
          Home
        </Link>
        <span className="text-rhip-muted">/</span>
        <Link to="/community" className="text-rhip-muted hover:text-rhip-teal">
          Community
        </Link>
        {pathname !== '/community' && (
          <>
            <span className="text-rhip-muted">/</span>
            <span className="text-rhip-body font-medium">
              {pathname.includes('/specialists')
                ? 'Our Specialists'
                : pathname.includes('/services')
                  ? 'Services'
                  : 'Details'}
            </span>
          </>
        )}
      </div>
      <div className="max-w-6xl mx-auto px-6 pb-4 flex flex-wrap gap-2">
        {NAV_LINKS.map(({ to, label, exact }) => (
          <Link
            key={to}
            to={to}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              isActive(to, exact)
                ? 'bg-rhip-teal text-white'
                : 'bg-rhip-lightBg text-rhip-body hover:bg-rhip-lightTeal'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
