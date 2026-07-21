import { Link } from 'react-router-dom'
import BrandLogo from '../ui/BrandLogo'

export default function PublicNavBar({ hideLogin = false }) {
  const scrollToHTH = () => {
    document.getElementById('hth-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav className="bg-white px-6 md:px-8 py-4 flex items-center justify-between border-b border-rhip-border">
      <div className="flex items-center gap-6">
        <Link to="/">
          <BrandLogo />
        </Link>
        <Link
          to="/community"
          className="text-rhip-body text-sm font-medium hover:text-rhip-teal transition-colors hidden sm:inline"
        >
          Community
        </Link>
        <Link
          to="/government"
          className="text-rhip-body text-sm font-medium hover:text-rhip-teal transition-colors hidden sm:inline"
        >
          Government
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {!hideLogin && (
          <Link
            to="/auth/login"
            className="text-rhip-body text-sm font-medium hover:text-rhip-teal transition-colors hidden sm:inline"
          >
            Log In
          </Link>
        )}
        <button
          type="button"
          onClick={scrollToHTH}
          className="rhip-btn-primary text-sm px-5 py-2"
        >
          Become a Tenant
        </button>
      </div>
    </nav>
  )
}
