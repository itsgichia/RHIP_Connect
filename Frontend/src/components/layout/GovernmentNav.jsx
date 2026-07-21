import { Link, useLocation } from 'react-router-dom'

const NAV_LINKS = [
  { id: 'overview', label: 'Overview' },
  { id: 'metrics', label: 'Impact Metrics' },
  { id: 'pipeline', label: 'Translation Pipeline' },
  { id: 'stories', label: 'Success Stories' },
  { id: 'briefing', label: 'Request Briefing' },
]

export default function GovernmentNav({ activeTab, onTabChange }) {
  const { pathname } = useLocation()

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link to="/" className="text-rhip-muted hover:text-rhip-teal">
          Home
        </Link>
        <span className="text-rhip-muted">/</span>
        <span className="text-rhip-body font-medium">Government</span>
      </div>
      <div className="max-w-6xl mx-auto px-6 pb-4 flex flex-wrap gap-2">
        {NAV_LINKS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-rhip-teal text-white'
                : 'bg-rhip-lightBg text-rhip-body hover:bg-rhip-lightTeal'
            }`}
          >
            {label}
          </button>
        ))}
        {pathname === '/government' && (
          <a
            href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'}/government/export`}
            className="ml-auto px-4 py-2 rounded-full text-sm font-medium border border-rhip-teal text-rhip-teal hover:bg-rhip-lightTeal transition-colors"
          >
            Export snapshot ↓
          </a>
        )}
      </div>
    </div>
  )
}
