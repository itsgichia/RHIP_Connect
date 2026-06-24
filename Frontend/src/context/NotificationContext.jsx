import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../hooks/useApi'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    try {
      const { data } = await api.get('/notifications')
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } catch {
      // ignore poll errors
    }
  }, [isAuthenticated])

  useEffect(() => {
    refresh()
    if (!isAuthenticated) return undefined
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh, isAuthenticated])

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  const markAllRead = async () => {
    await api.patch('/notifications/read-all')
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return ctx
}
