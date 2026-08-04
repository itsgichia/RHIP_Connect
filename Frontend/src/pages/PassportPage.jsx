import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { canViewCpd } from '../utils/roles'
import PassportCard from '../components/ui/PassportCard'
import TierBadge from '../components/ui/TierBadge'

const EVENT_TYPE_LABELS = {
  conference: 'Conference',
  workshop: 'Workshop',
  showcase: 'Showcase',
  networking: 'Networking',
}

const CPD_CATEGORY_LABELS = {
  educational_activities: 'Educational Activities',
  reviewing_performance: 'Reviewing Performance',
  measuring_outcomes: 'Measuring Outcomes',
}

export default function PassportPage() {
  const { user } = useAuth()
  const { refresh: refreshNotifications } = useNotifications()
  const [passport, setPassport] = useState(null)
  const [events, setEvents] = useState([])
  const [cpd, setCpd] = useState(null)
  const [qrCode, setQrCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [showStamp, setShowStamp] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(true)
  // Prefer server flag (covers dual clinician+researcher); fall back to local session facets.
  const showCpd =
    passport?.can_view_cpd === true || canViewCpd(user?.role, user?.identity_facets)

  const loadPassport = useCallback(async () => {
    setLoading(true)
    try {
      const [passportRes, eventsRes] = await Promise.all([
        api.get('/passport/my'),
        api.get('/passport/events'),
      ])
      setPassport(passportRes.data)
      setEvents(eventsRes.data.events)

      const allowCpd =
        passportRes.data?.can_view_cpd === true ||
        canViewCpd(user?.role, user?.identity_facets)
      if (allowCpd) {
        const cpdRes = await api.get('/passport/cpd')
        setCpd(cpdRes.data)
      } else {
        setCpd(null)
      }
    } finally {
      setLoading(false)
    }
  }, [user?.role, user?.identity_facets])

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
        if (data.cpd_eligible && data.cpd_hours) {
          toast.success(
            `${data.cpd_hours} CPD hours logged for export`,
            { duration: 4000 }
          )
        }
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

  const handleExportCpd = async () => {
    setExporting(true)
    try {
      const { data } = await api.get('/passport/cpd/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([data], { type: 'text/csv' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `rhip-cpd-transcript-${passport?.year || new Date().getFullYear()}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('CPD transcript downloaded')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Export failed')
    } finally {
      setExporting(false)
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

          {showCpd && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-semibold text-rhip-dark">CPD evidence</h2>
                  <p className="text-sm text-rhip-muted mt-1">
                    Verified attendance for logging in MyCPD — not a college certificate.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCpd}
                  disabled={exporting || !cpd?.events_count}
                  className="px-4 py-2 bg-rhip-teal text-white rounded-xl text-sm font-medium hover:bg-rhip-seafoam disabled:opacity-50"
                >
                  {exporting ? 'Exporting…' : 'Export CSV for MyCPD'}
                </button>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl bg-rhip-lightTeal/40 px-4 py-3">
                  <p className="text-xs text-rhip-muted">Suggested hours ({passport?.year})</p>
                  <p className="font-display text-xl font-semibold text-rhip-dark">
                    {cpd?.total_hours ?? passport?.cpd_hours_total ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <p className="text-xs text-rhip-muted">CPD-eligible events</p>
                  <p className="font-display text-xl font-semibold text-rhip-dark">
                    {cpd?.events_count ?? passport?.cpd_events_count ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <p className="text-xs text-rhip-muted">By category</p>
                  <p className="text-sm text-rhip-body mt-1">
                    {cpd?.hours_by_category && Object.keys(cpd.hours_by_category).length > 0
                      ? Object.entries(cpd.hours_by_category).map(([key, hours]) => (
                          <span key={key} className="block">
                            {CPD_CATEGORY_LABELS[key] || key}: {hours}h
                          </span>
                        ))
                      : '—'}
                  </p>
                </div>
              </div>

              {cpd?.entries?.length > 0 ? (
                <ul className="space-y-3 border-t border-gray-100 pt-4">
                  {cpd.entries.map((entry) => (
                    <li key={`${entry.event_id}-${entry.scanned_at}`} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-rhip-dark">{entry.event_name}</p>
                        <p className="text-xs text-rhip-muted mt-0.5">
                          {CPD_CATEGORY_LABELS[entry.cpd_category] || entry.cpd_category}
                          {entry.cpd_notes ? ` · ${entry.cpd_notes}` : ''}
                        </p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="font-medium text-rhip-teal">{entry.cpd_hours}h</p>
                        <p className="text-xs text-rhip-muted">
                          {format(new Date(entry.event_date), 'd MMM yyyy')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-rhip-muted border-t border-gray-100 pt-4">
                  Scan a CPD-eligible event QR to build your transcript. Demo:{' '}
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">RHIP-CONF-2026-04</code>
                </p>
              )}

              {cpd?.disclaimer && (
                <p className="text-xs text-rhip-muted mt-4 pt-4 border-t border-gray-100">
                  {cpd.disclaimer}
                </p>
              )}
            </div>
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
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className="text-xs px-2 py-0.5 bg-rhip-lightTeal text-rhip-teal rounded-full">
                            {EVENT_TYPE_LABELS[ev.type] || ev.type}
                          </span>
                          {ev.cpd_eligible && (
                            <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full">
                              {ev.cpd_hours}h CPD
                            </span>
                          )}
                        </div>
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
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-rhip-muted rounded-full">
                            {EVENT_TYPE_LABELS[ev.type] || ev.type}
                          </span>
                          {ev.cpd_eligible && (
                            <span className="text-xs px-2 py-0.5 bg-amber-50/80 text-amber-800 rounded-full">
                              {ev.cpd_hours}h CPD
                            </span>
                          )}
                        </div>
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
