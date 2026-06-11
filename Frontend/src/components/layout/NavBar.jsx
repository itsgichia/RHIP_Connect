import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../utils/roles'

export default function NavBar() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
      <span className="font-display text-lg font-semibold text-rhip-dark">RHIP Connect</span>
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-rhip-lightBg transition-colors"
        >
          <span className="px-2 py-0.5 bg-rhip-lightTeal text-rhip-teal text-xs font-medium rounded-full">
            {ROLE_LABELS[user?.role] || user?.role}
          </span>
          <span className="text-sm font-medium text-rhip-body">{user?.name}</span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-rhip-body hover:bg-rhip-lightBg"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
