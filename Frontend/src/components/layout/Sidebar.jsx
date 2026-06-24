import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getNavLinks } from '../../utils/roles'

export default function Sidebar() {
  const { user } = useAuth()
  const links = getNavLinks(user?.role)

  return (
    <aside className="w-56 bg-rhip-dark min-h-[calc(100vh-57px)] p-4 flex-shrink-0">
      <nav className="space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) =>
              `block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
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
    </aside>
  )
}
