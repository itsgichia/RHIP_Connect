import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { BellIcon } from '@heroicons/react/24/outline'
import { useNotifications } from '../../context/NotificationContext'

const TYPE_ICONS = {
  match: '🧠',
  connection_request: '👤',
  message: '💬',
  passport: '🎫',
  system: '🔔',
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const handleClick = async (notification) => {
    if (!notification.is_read) {
      await markRead(notification.id)
    }
    setOpen(false)
    if (notification.action_url) {
      navigate(notification.action_url)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-rhip-lightBg transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="w-6 h-6 text-rhip-body" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-rhip-coral text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-rhip-dark text-sm">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-rhip-teal hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-rhip-lightBg transition-colors ${
                    !n.is_read ? 'bg-rhip-lightTeal/30' : ''
                  }`}
                >
                  <div className="flex gap-2">
                    <span className="text-sm">{TYPE_ICONS[n.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-rhip-dark truncate">{n.title}</p>
                      <p className="text-xs text-rhip-muted line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-rhip-muted mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              {notifications.length === 0 && (
                <p className="px-4 py-8 text-sm text-rhip-muted text-center">No notifications yet</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
