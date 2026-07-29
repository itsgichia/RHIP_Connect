import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../hooks/useApi'
import ToggleSwitch from './ToggleSwitch'

const PREF_OPTIONS = [
  {
    key: 'email_matches',
    label: 'Challenge matches',
    description: 'When you are matched to a clinical challenge',
  },
  {
    key: 'email_connections',
    label: 'Connection requests',
    description: 'When someone wants to connect with you',
  },
  {
    key: 'email_messages',
    label: 'New messages',
    description: 'When you receive a new message in an active thread',
  },
  {
    key: 'email_passport',
    label: 'Passport updates',
    description: 'When you reach a new Precinct Passport tier',
  },
]

const DEFAULT_PREFS = {
  email_matches: true,
  email_connections: true,
  email_messages: true,
  email_passport: true,
}

export default function EmailNotificationPreferences() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { data } = await api.get('/notifications/preferences')
        if (!cancelled) setPrefs(data)
      } catch {
        if (!cancelled) toast.error('Could not load email preferences')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = async (key, next) => {
    const previous = prefs[key]
    setPrefs((p) => ({ ...p, [key]: next }))
    setSavingKey(key)
    try {
      const { data } = await api.patch('/notifications/preferences', { [key]: next })
      setPrefs(data)
    } catch {
      setPrefs((p) => ({ ...p, [key]: previous }))
      toast.error('Could not update preference')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <h3 className="font-semibold text-rhip-dark mb-1">Email notifications</h3>
      <p className="text-xs text-rhip-muted mb-4">
        In-app notifications are always delivered. Choose which events also send email.
      </p>
      {loading ? (
        <p className="text-sm text-rhip-muted">Loading preferences…</p>
      ) : (
        <ul className="space-y-4">
          {PREF_OPTIONS.map((opt) => (
            <li key={opt.key}>
              <ToggleSwitch
                id={`email-pref-${opt.key}`}
                checked={!!prefs[opt.key]}
                disabled={savingKey === opt.key}
                label={opt.label}
                description={opt.description}
                onChange={(next) => toggle(opt.key, next)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
