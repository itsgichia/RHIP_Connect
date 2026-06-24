import { Link } from 'react-router-dom'

export default function PublicNavBar({ hideLogin = false }) {
  const scrollToHTH = () => {
    document.getElementById('hth-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav className="bg-rhip-dark px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        {!hideLogin && (
          <Link
            to="/auth/login"
            className="px-4 py-2 border border-rhip-ice text-rhip-ice rounded-full text-sm font-medium hover:bg-rhip-teal hover:border-rhip-teal hover:text-white transition-colors"
          >
            Log In
          </Link>
        )}
        <Link to="/" className="text-white font-display text-xl font-semibold">
          RHIP Connect
        </Link>
        <Link
          to="/community"
          className="text-rhip-ice text-sm font-medium hover:text-white transition-colors hidden sm:inline"
        >
          Community
        </Link>
      </div>
      <button
        onClick={scrollToHTH}
        className="px-5 py-2 bg-rhip-teal text-white rounded-full text-sm font-medium hover:bg-rhip-seafoam transition-colors"
      >
        Become a Tenant
      </button>
    </nav>
  )
}
