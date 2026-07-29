import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../hooks/useApi'
import EmailNotificationPreferences from '../components/ui/EmailNotificationPreferences'
import ToggleSwitch from '../components/ui/ToggleSwitch'

export default function SettingsPage() {
  const [isPublic, setIsPublic] = useState(true)
  const [loadingPrivacy, setLoadingPrivacy] = useState(true)
  const [savingPrivacy, setSavingPrivacy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { data } = await api.get('/directory/me')
        if (!cancelled) setIsPublic(!!data.is_public)
      } catch {
        if (!cancelled) toast.error('Could not load privacy settings')
      } finally {
        if (!cancelled) setLoadingPrivacy(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const togglePublic = async (next) => {
    if (savingPrivacy) return
    const previous = isPublic
    setIsPublic(next)
    setSavingPrivacy(true)
    try {
      const { data } = await api.patch('/directory/me', { is_public: next })
      setIsPublic(!!data.is_public)
      toast.success(
        data.is_public
          ? 'You are now visible in Directory & Map'
          : 'Profile hidden from Directory & Map',
      )
    } catch (err) {
      setIsPublic(previous)
      toast.error(err.response?.data?.detail || 'Could not update privacy')
    } finally {
      setSavingPrivacy(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-2">Settings</h1>
      <p className="text-rhip-muted mb-8">
        Manage privacy and email notification preferences for your account.
      </p>

      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-rhip-dark mb-1">Privacy</h3>
          <p className="text-xs text-rhip-muted mb-4">
            Control whether others can find you on the platform.
          </p>
          {loadingPrivacy ? (
            <p className="text-sm text-rhip-muted">Loading privacy…</p>
          ) : (
            <ToggleSwitch
              id="privacy-directory-map"
              checked={isPublic}
              disabled={savingPrivacy}
              label="Show me in Directory & Map"
              description="Opt in when you are ready — your profile stays private until you choose to appear."
              onChange={togglePublic}
            />
          )}
        </div>

        <EmailNotificationPreferences />
      </div>
    </div>
  )
}
