import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import BrandLogo from '../ui/BrandLogo'
import RoleBadge from '../ui/RoleBadge'
import NotificationBell from '../ui/NotificationBell'
import api from '../../hooks/useApi'

export default function NavBar() {
  const { user, logout, updateUser } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openingProfile, setOpeningProfile] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!menuOpen) return undefined
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
    navigate('/')
  }

  const openOwnProfile = async () => {
    setMenuOpen(false)
    if (user?.profile_id) {
      navigate(`/directory/${user.profile_id}`)
      return
    }
    setOpeningProfile(true)
    try {
      const { data } = await api.get('/directory/me')
      if (data?.id && updateUser) {
        updateUser({ profile_id: data.id })
      }
      navigate(`/directory/${data.id}`)
    } catch {
      toast.error('No profile found for this account yet')
    } finally {
      setOpeningProfile(false)
    }
  }

  const handleSettings = () => {
    setMenuOpen(false)
    navigate('/settings')
  }

  const handleMyProfile = () => openOwnProfile()

  return (
    <header className="bg-white border-b border-rhip-border px-6 py-3 flex items-center justify-between">
      <BrandLogo />
      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 sm:gap-3 px-3 py-2 rounded-xl hover:bg-rhip-lightBg transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-rhip-lightTeal text-rhip-teal flex items-center justify-center text-xs font-semibold shrink-0">
              {(user?.name || '?')
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col items-start min-w-0">
              <span className="text-sm font-medium text-rhip-dark truncate max-w-[140px]">
                {user?.name}
              </span>
              <RoleBadge role={user?.role} facets={user?.identity_facets} />
            </div>
            <ChevronDownIcon
              className={`w-4 h-4 text-rhip-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-rhip-lg border border-rhip-border py-1 z-50"
            >
              <div className="px-4 py-3 border-b border-rhip-border">
                <p className="text-sm font-medium text-rhip-dark truncate">{user?.name}</p>
                {user?.email && (
                  <p className="text-xs text-rhip-muted truncate mt-0.5">{user.email}</p>
                )}
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleMyProfile}
                disabled={openingProfile}
                className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-rhip-body hover:bg-rhip-lightBg disabled:opacity-50"
              >
                <UserCircleIcon className="w-4 h-4 text-rhip-muted" />
                {openingProfile ? 'Opening…' : 'My profile'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleSettings}
                disabled={openingProfile}
                className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-rhip-body hover:bg-rhip-lightBg disabled:opacity-50"
              >
                <Cog6ToothIcon className="w-4 h-4 text-rhip-muted" />
                Settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-rhip-body hover:bg-rhip-lightBg"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4 text-rhip-muted" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
