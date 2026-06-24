import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../hooks/useApi'
import { useNotifications } from '../context/NotificationContext'
import PassportCard from '../components/ui/PassportCard'
import TierBadge from '../components/ui/TierBadge'

const EVENT_TYPE_LABELS = {
  conference: 'Conference',
  workshop: 'Workshop',
  showcase: 'Showcase',
  networking: 'Networking',
}

export default function PassportPage() {
  const { refresh: refreshNotifications } = useNotifications()
  const [passport, setPassport] = useState(null)
  const [events, setEvents] = useState([])
  const [qrCode, setQrCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [showStamp, setShowStamp] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadPassport = useCallback(async () => {
    setLoading(true)
    try {
      const [passportRes, eventsRes] = await Promise.all([
        api.get('/passport/my'),
        api.get('/passport/events'),
      ])
      setPassport(passportRes.data)
      setEvents(eventsRes.data.events)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPassport()
  }, [loadPassport])

  const handleScan = async (e) => {
    e.preventDefault()
    if (!qrCode.trim()) return
    setScanning(true)
    try {
      const { data } = await api.post('/passport/scan', { qr_code: qrCode.trim() })
      if (data.already_scanned) {
        toast.error("You've already scanned this event")
      } else if (data.entry_logged) {
        setShowStamp(true)
        toast.success(`Added to your passport — ${data.event_name}!`)
        setTimeout(() => setShowStamp(false), 2000)
        if (data.tier_upgraded) {
          toast.success(`Tier upgraded to ${data.current_tier}!`, { duration: 4000 })
        }
        setQrCode('')
      }
      await loadPassport()
      refreshNotifications()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  if (loading) {
    return <p className="text-rhip-muted">Loading passport…</p>
  }

  const attended = events.filter((ev) => ev.attended)
  const upcoming = events.filter((ev) => !ev.attended)

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-6">Precinct Passport</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {passport && (
            <PassportCard
              tier={passport.tier}
              eventsAttended={passport.events_attended}
              totalEvents={passport.total_events_in_year}
              year={passport.year}
              pastGold={passport.past_gold}
              nextReward={passport.next_reward}
            />
          )}

          <div className="bg-white rounded-2xl p-6 shadow-sm relative overflow-hidden">
            {showStamp && (
              <div className="absolute inset-0 flex items-center justify-center bg-rhip-teal/10 z-10 animate-pulse">
                <div className="w-32 h-32 rounded-full border-4 border-rhip-teal flex items-center justify-center rotate-[-12deg] opacity-80">
                  <span className="font-display text-rhip-teal font-bold text-lg">STAMPED</span>
                </div>
              </div>
            )}
            <h2 className="font-semibold text-rhip-dark mb-4">Scan Event QR Code</h2>
            <form onSubmit={handleScan} className="flex gap-3">
              <input
                type="text"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                placeholder="Enter event QR code (e.g. RHIP-SHOWCASE-2026)"
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
              />
              <button
                type="submit"
                disabled={!qrCode.trim() || scanning}
                className="px-5 py-2 bg-rhip-teal text-white rounded-xl text-sm font-medium hover:bg-rhip-seafoam disabled:opacity-50"
              >
                {scanning ? 'Scanning…' : 'Scan'}
              </button>
            </form>
            <p className="text-xs text-rhip-muted mt-2">
              Demo codes: RHIP-SHOWCASE-2026, RHIP-CONF-2026-04, RHIP-WORKSHOP-2026-05
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-4">Attended ({attended.length})</h3>
              {attended.length > 0 ? (
                <ul className="space-y-3">
                  {attended.map((ev) => (
                    <li key={ev.id} className="flex items-start justify-between gap-2 text-sm">
                      <div>
                        <p className="font-medium text-rhip-dark">{ev.name}</p>
                        <span className="text-xs px-2 py-0.5 bg-rhip-lightTeal text-rhip-teal rounded-full">
                          {EVENT_TYPE_LABELS[ev.type] || ev.type}
                        </span>
                      </div>
                      <span className="text-xs text-rhip-muted whitespace-nowrap">
                        {format(new Date(ev.date), 'd MMM yyyy')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-rhip-muted">No events attended yet. Scan a QR code at your next RHIP event.</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-4">Upcoming ({upcoming.length})</h3>
              {upcoming.length > 0 ? (
                <ul className="space-y-3">
                  {upcoming.map((ev) => (
                    <li key={ev.id} className="flex items-start justify-between gap-2 text-sm opacity-75">
                      <div>
                        <p className="font-medium text-rhip-dark">{ev.name}</p>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-rhip-muted rounded-full">
                          {EVENT_TYPE_LABELS[ev.type] || ev.type}
                        </span>
                      </div>
                      <span className="text-xs text-rhip-muted whitespace-nowrap">
                        {format(new Date(ev.date), 'd MMM yyyy')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-rhip-muted">All events attended — Gold tier within reach!</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm h-fit">
          <h3 className="font-display font-semibold text-rhip-dark mb-4">Reward Tiers</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
              <div className="flex items-center gap-2 mb-1">
                <TierBadge tier="bronze" />
                <span className="text-xs text-rhip-muted">3 events</span>
              </div>
              <p className="text-sm text-rhip-body">Profile badge + featured in directory</p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <TierBadge tier="silver" />
                <span className="text-xs text-rhip-muted">6 events</span>
              </div>
              <p className="text-sm text-rhip-body">Priority grant application access</p>
            </div>
            <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-100">
              <div className="flex items-center gap-2 mb-1">
                <TierBadge tier="gold" />
                <span className="text-xs text-rhip-muted">All events this year</span>
              </div>
              <p className="text-sm text-rhip-body">Research grant contribution awarded</p>
            </div>
          </div>
          <p className="text-xs text-rhip-muted mt-6 pt-4 border-t border-gray-100">
            Tiers reset on 1 January. Past Gold members are permanently recognised.
          </p>
        </div>
      </div>
    </div>
  )
}
