import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { isAdmin, ROLE_LABELS, ROLES } from '../utils/roles'
import CommunityAdminTab from '../components/admin/CommunityAdminTab'

const TABS = [
  { key: 'users', label: 'Users' },
  { key: 'events', label: 'Events' },
  { key: 'enquiries', label: 'Enquiries' },
  { key: 'kpis', label: 'Live KPIs' },
  { key: 'community', label: 'Community' },
  { key: 'passport', label: 'Passport' },
]

const EVENT_TYPES = [
  { value: 'conference', label: 'Conference' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'networking', label: 'Networking' },
]

const EVENT_TYPE_LABELS = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.label]))

const ROLE_OPTIONS = [
  ROLES.ADMIN,
  ROLES.CLINICIAN,
  ROLES.RESEARCHER,
  ROLES.INDUSTRY,
  ROLES.INVESTOR,
]

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
        active
          ? 'bg-rhip-teal text-white'
          : 'bg-white text-rhip-muted hover:text-rhip-dark hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

function UsersTab({ users, onUpdate }) {
  const [saving, setSaving] = useState(null)

  const handleRoleChange = async (userId, role) => {
    setSaving(userId)
    try {
      await onUpdate(userId, { role })
      toast.success('Role updated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update role')
    } finally {
      setSaving(null)
    }
  }

  const handleActiveToggle = async (userId, isActive) => {
    setSaving(userId)
    try {
      await onUpdate(userId, { is_active: isActive })
      toast.success(isActive ? 'User activated' : 'User deactivated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update status')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-rhip-muted">
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Email</th>
              <th className="px-6 py-4 font-medium">Role</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-6 py-4 font-medium text-rhip-dark">{u.name}</td>
                <td className="px-6 py-4 text-rhip-body">{u.email}</td>
                <td className="px-6 py-4">
                  <select
                    value={u.role}
                    disabled={saving === u.id}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={u.is_active}
                      disabled={saving === u.id}
                      onChange={(e) => handleActiveToggle(u.id, e.target.checked)}
                      className="rounded border-gray-300 text-rhip-teal focus:ring-rhip-teal"
                    />
                    <span className={u.is_active ? 'text-rhip-teal' : 'text-rhip-muted'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                      {!u.is_verified && ' (unverified)'}
                    </span>
                  </label>
                </td>
                <td className="px-6 py-4 text-rhip-muted whitespace-nowrap">
                  {format(new Date(u.created_at), 'd MMM yyyy')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && (
        <p className="px-6 py-8 text-center text-rhip-muted">No users found.</p>
      )}
    </div>
  )
}

function EventsTab({ events, onCreate }) {
  const [form, setForm] = useState({ name: '', date: '', type: 'conference' })
  const [creating, setCreating] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.date) return
    setCreating(true)
    try {
      await onCreate(form)
      toast.success('Event created')
      setForm({ name: '', date: '', type: 'conference' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create event')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-semibold text-rhip-dark mb-4">Create Event</h3>
        <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs text-rhip-muted mb-1">Event name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. RHIP Innovation Showcase"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
            />
          </div>
          <div>
            <label className="block text-xs text-rhip-muted mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
            />
          </div>
          <div>
            <label className="block text-xs text-rhip-muted mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating || !form.name.trim() || !form.date}
            className="md:col-span-4 md:col-start-4 px-5 py-2 bg-rhip-teal text-white rounded-xl text-sm font-medium hover:bg-rhip-seafoam disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create Event'}
          </button>
        </form>
        <p className="text-xs text-rhip-muted mt-3">A unique QR code is generated automatically for passport scanning.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-rhip-muted">
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">QR Code</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-gray-50">
                  <td className="px-6 py-4 font-medium text-rhip-dark">{ev.name}</td>
                  <td className="px-6 py-4 text-rhip-body whitespace-nowrap">
                    {format(new Date(ev.date), 'd MMM yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-0.5 bg-rhip-lightTeal text-rhip-teal rounded-full">
                      {EVENT_TYPE_LABELS[ev.type] || ev.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-rhip-dark">{ev.qr_code}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {events.length === 0 && (
          <p className="px-6 py-8 text-center text-rhip-muted">No events yet.</p>
        )}
      </div>
    </div>
  )
}

function EnquiriesTab({ enquiries }) {
  const { tenants, investors } = enquiries

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-semibold text-rhip-dark mb-4">
          Tenant Enquiries
          <span className="ml-2 text-sm font-normal text-rhip-muted">({tenants.length})</span>
        </h3>
        {tenants.length > 0 ? (
          <ul className="space-y-4">
            {tenants.map((t) => (
              <li key={t.id} className="p-4 rounded-xl bg-rhip-lightBg border border-gray-100">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <p className="font-medium text-rhip-dark">{t.company_name}</p>
                  <span className="text-xs text-rhip-muted whitespace-nowrap">
                    {format(new Date(t.submitted_at), 'd MMM yyyy')}
                  </span>
                </div>
                <p className="text-sm text-rhip-body">{t.contact_name} · {t.email}</p>
                <p className="text-sm text-rhip-muted mt-1">
                  {t.company_type} · {t.desks_needed} desks
                  {t.preferred_start && ` · Start ${format(new Date(t.preferred_start), 'MMM yyyy')}`}
                </p>
                {t.message && <p className="text-sm text-rhip-body mt-2">{t.message}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-rhip-muted">No tenant enquiries yet.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-semibold text-rhip-dark mb-4">
          Investor Contacts
          <span className="ml-2 text-sm font-normal text-rhip-muted">({investors.length})</span>
        </h3>
        {investors.length > 0 ? (
          <ul className="space-y-4">
            {investors.map((inv) => (
              <li key={inv.id} className="p-4 rounded-xl bg-rhip-lightBg border border-gray-100">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <p className="font-medium text-rhip-dark">{inv.name}</p>
                  <span className="text-xs text-rhip-muted whitespace-nowrap">
                    {format(new Date(inv.submitted_at), 'd MMM yyyy')}
                  </span>
                </div>
                <p className="text-sm text-rhip-body">{inv.email} · {inv.phone}</p>
                <p className="text-sm text-rhip-body mt-2">{inv.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-rhip-muted">No investor contacts yet.</p>
        )}
      </div>
    </div>
  )
}

function KpisTab({ kpis, onUpdate }) {
  const [editing, setEditing] = useState({})
  const [saving, setSaving] = useState(null)
  const liveKpis = kpis.filter((k) => k.is_live)

  const handleSave = async (kpi) => {
    const displayValue = editing[kpi.id] ?? kpi.display_value
    setSaving(kpi.id)
    try {
      await onUpdate(kpi.id, { display_value: displayValue })
      toast.success('KPI updated')
      setEditing((prev) => {
        const next = { ...prev }
        delete next[kpi.id]
        return next
      })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update KPI')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <p className="text-sm text-rhip-muted mb-6">
        Update live KPI values shown on the public landing page. Changes take effect immediately.
      </p>
      {liveKpis.length > 0 ? (
        <div className="space-y-4">
          {liveKpis.map((kpi) => (
            <div key={kpi.id} className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-rhip-lightBg">
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium text-rhip-dark">{kpi.display_label}</p>
                <p className="text-xs text-rhip-muted">{kpi.metric_name} · {kpi.period}</p>
              </div>
              <input
                type="text"
                value={editing[kpi.id] ?? kpi.display_value}
                onChange={(e) => setEditing((prev) => ({ ...prev, [kpi.id]: e.target.value }))}
                className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
              />
              <button
                type="button"
                disabled={saving === kpi.id}
                onClick={() => handleSave(kpi)}
                className="px-4 py-2 bg-rhip-teal text-white rounded-lg text-sm font-medium hover:bg-rhip-seafoam disabled:opacity-50"
              >
                {saving === kpi.id ? 'Saving…' : 'Save'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-rhip-muted">No live KPIs configured.</p>
      )}
    </div>
  )
}

function PassportTab({ onReset }) {
  const [resetting, setResetting] = useState(false)

  const handleReset = async () => {
    if (!window.confirm('Reset passport year for all users? Gold members will receive Past Gold status.')) {
      return
    }
    setResetting(true)
    try {
      await onReset()
      toast.success('Passport year reset successfully')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm max-w-xl">
      <h3 className="font-semibold text-rhip-dark mb-2">Annual Passport Reset</h3>
      <p className="text-sm text-rhip-muted mb-6">
        Normally runs on 1 January. Use this to demo the annual reset: awards Past Gold to current
        Gold members, then resets all tiers and event counts for the new year.
      </p>
      <button
        type="button"
        onClick={handleReset}
        disabled={resetting}
        className="px-5 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
      >
        {resetting ? 'Resetting…' : 'Reset Passport Year'}
      </button>
    </div>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [events, setEvents] = useState([])
  const [enquiries, setEnquiries] = useState({ tenants: [], investors: [] })
  const [kpis, setKpis] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, eventsRes, enquiriesRes, kpisRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/events'),
        api.get('/admin/enquiries'),
        api.get('/impact/kpis/all'),
      ])
      setUsers(usersRes.data)
      setEvents(eventsRes.data)
      setEnquiries(enquiriesRes.data)
      setKpis(kpisRes.data)
    } catch {
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin(user?.role)) loadData()
  }, [user, loadData])

  const updateUser = async (userId, data) => {
    const { data: updated } = await api.patch(`/admin/users/${userId}`, data)
    setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
  }

  const createEvent = async (form) => {
    const { data: created } = await api.post('/admin/events', {
      name: form.name.trim(),
      date: form.date,
      type: form.type,
    })
    setEvents((prev) => [created, ...prev])
  }

  const updateKpi = async (kpiId, data) => {
    const { data: updated } = await api.patch(`/admin/kpis/${kpiId}`, data)
    setKpis((prev) => prev.map((k) => (k.id === kpiId ? updated : k)))
  }

  const resetPassport = async () => {
    await api.post('/admin/passport/reset-year')
  }

  if (!isAdmin(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  if (loading) {
    return <p className="text-rhip-muted">Loading admin panel…</p>
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-2">Admin Panel</h1>
      <p className="text-rhip-muted mb-6">Manage users, events, enquiries, and platform settings.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'enquiries' && (enquiries.tenants.length + enquiries.investors.length) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs bg-white/20 rounded-full">
                {enquiries.tenants.length + enquiries.investors.length}
              </span>
            )}
          </TabButton>
        ))}
      </div>

      {tab === 'users' && <UsersTab users={users} onUpdate={updateUser} />}
      {tab === 'events' && <EventsTab events={events} onCreate={createEvent} />}
      {tab === 'enquiries' && <EnquiriesTab enquiries={enquiries} />}
      {tab === 'kpis' && <KpisTab kpis={kpis} onUpdate={updateKpi} />}
      {tab === 'community' && <CommunityAdminTab />}
      {tab === 'passport' && <PassportTab onReset={resetPassport} />}
    </div>
  )
}
