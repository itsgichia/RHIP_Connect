import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import NavBar from './NavBar'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const { isAuthenticated } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!mobileNavOpen) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileNavOpen])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const onChange = (event) => {
      if (event.matches) setMobileNavOpen(false)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />
  }

  return (
    <div className="min-h-screen bg-rhip-lightBg">
      <NavBar
        mobileNavOpen={mobileNavOpen}
        onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
      />
      <div className="flex min-h-0 h-[calc(100vh-57px)]">
        <Sidebar
          mobileNavOpen={mobileNavOpen}
          onCloseMobileNav={() => setMobileNavOpen(false)}
        />
        <main className="flex-1 min-w-0 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
