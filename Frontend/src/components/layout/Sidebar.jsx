import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getNavLinks } from '../../utils/roles'
import BrandLogo from '../ui/BrandLogo'

function NavLinks({ links, onNavigate }) {
  return (
    <nav className="space-y-1 flex-1">
      {links.map((link) => (
        <NavLink
          key={link.path}
          to={link.path}
          onClick={onNavigate}
          className={({ isActive }) =>
            `block px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-rhip-teal text-white'
                : 'text-rhip-ice hover:bg-rhip-navy hover:text-white'
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarFooter() {
  return (
    <div className="pt-4 mt-4 border-t border-rhip-sidebar-border">
      <p className="px-3 text-xs text-rhip-on-dark-muted">
        Randwick Health &amp; Innovation Precinct
      </p>
    </div>
  )
}

export default function Sidebar({ mobileNavOpen = false, onCloseMobileNav }) {
  const { user } = useAuth()
  const links = getNavLinks(user?.role)

  useEffect(() => {
    if (!mobileNavOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseMobileNav?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileNavOpen, onCloseMobileNav])

  return (
    <>
      {/* Desktop permanent sidebar */}
      <aside className="hidden md:flex w-56 bg-rhip-dark h-full min-h-0 p-4 flex-shrink-0 flex-col overflow-y-auto">
        <div className="mb-6 px-1">
          <BrandLogo variant="light" />
        </div>
        <NavLinks links={links} />
        <SidebarFooter />
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={onCloseMobileNav}
          />
          <aside
            className="relative z-10 w-64 max-w-[85vw] h-full bg-rhip-dark p-4 flex flex-col shadow-rhip-lg"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <NavLinks links={links} onNavigate={onCloseMobileNav} />
            <SidebarFooter />
          </aside>
        </div>
      )}
    </>
  )
}
