import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { ROLE_LABELS, ROLES } from '../utils/roles'

export default function DashboardPage() {
  const { user } = useAuth()
  const { notifications } = useNotifications()
  const [stats, setStats] = useState({})

  useEffect(() => {
    const load = async () => {
      const results = {}
      try {
        if (user?.role === ROLES.CLINICIAN || user?.role === ROLES.RESEARCHER) {
          const { data } = await api.get('/challenges')
          const mine = user.role === ROLES.RESEARCHER
            ? data.challenges.filter((c) => c.status === 'matched').slice(0, 5)
            : data.challenges.filter((c) => c.posted_by?.name === user.name).slice(0, 5)
          results.challenges = mine
          const threads = await api.get('/threads')
          results.pendingConnections = threads.data.threads.filter((t) => t.pending_response).length
          results.activeThreads = threads.data.threads.filter((t) => t.status === 'active').length
        }
        if (user?.role === ROLES.INDUSTRY) {
          const { data } = await api.get('/challenges')
          results.challenges = data.challenges.slice(0, 5)
          const proj = await api.get('/pipeline/projects?readiness=commercial')
          results.projects = proj.data.projects.slice(0, 3)
        }
        if (user?.role === ROLES.INVESTOR) {
          const { data } = await api.get('/investor/overview')
          results.kpis = data.kpis.slice(0, 4)
          results.investableCount = data.investable_count
          results.hthOccupancy = data.hth_occupancy
          results.topProjects = data.projects.slice(0, 3)
        }
        if (user?.role === ROLES.ADMIN) {
          const [challengesRes, usersRes, enquiriesRes, eventsRes] = await Promise.all([
            api.get('/challenges'),
            api.get('/admin/users'),
            api.get('/admin/enquiries'),
            api.get('/admin/events'),
          ])
          results.pending = challengesRes.data.challenges.filter(
            (c) => c.status === 'pending' || c.status === 'matching'
          ).length
          const byRole = usersRes.data.reduce((acc, u) => {
            if (u.is_active) acc[u.role] = (acc[u.role] || 0) + 1
            return acc
          }, {})
          results.userCounts = byRole
          results.enquiryCount = enquiriesRes.data.tenants.length + enquiriesRes.data.investors.length
          const now = new Date()
          const in30 = new Date(now)
          in30.setDate(in30.getDate() + 30)
          results.upcomingEvents = eventsRes.data.filter((ev) => {
            const d = new Date(ev.date)
            return d >= now && d <= in30
          }).length
        }
        const kpiRes = await api.get('/impact/kpis/all').catch(() => null)
        if (kpiRes) results.kpiCount = kpiRes.data.length
      } catch {
        // partial load ok
      }
      setStats(results)
    }
    load()
  }, [user])

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-2">
        Welcome, {user?.name}
      </h1>
      <p className="text-rhip-muted mb-8">{ROLE_LABELS[user?.role]} Dashboard</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(user?.role === ROLES.CLINICIAN || user?.role === ROLES.RESEARCHER) && (
          <>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-4">
                {user?.role === ROLES.RESEARCHER ? 'Matched Challenges' : 'Recent Challenges'}
              </h3>
              {(stats.challenges || []).length > 0 ? (
                <ul className="space-y-2">
                  {stats.challenges.map((c) => (
                    <li key={c.id} className="text-sm">
                      <Link to="/challenges" className="text-rhip-teal hover:underline">{c.title}</Link>
                      <span className="text-rhip-muted ml-2">({c.status})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-rhip-muted">No challenges yet.</p>
              )}
              {user?.role === ROLES.CLINICIAN && (
                <Link
                  to="/challenges"
                  className="inline-block mt-4 px-4 py-2 bg-rhip-teal text-white rounded-xl text-sm font-medium hover:bg-rhip-seafoam"
                >
                  Post a Challenge
                </Link>
              )}
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-2">Connection Requests</h3>
              <p className="font-display text-3xl font-bold text-rhip-teal">{stats.pendingConnections ?? 0}</p>
              <Link to="/messages" className="text-sm text-rhip-teal hover:underline mt-2 inline-block">
                View messages →
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-4">Recent Notifications</h3>
              <ul className="space-y-2">
                {notifications.slice(0, 5).map((n) => (
                  <li key={n.id} className="text-sm text-rhip-body">
                    <span className={!n.is_read ? 'font-medium' : ''}>{n.title}</span>
                  </li>
                ))}
                {notifications.length === 0 && (
                  <li className="text-sm text-rhip-muted">No notifications yet.</li>
                )}
              </ul>
            </div>
            <div className="bg-rhip-dark rounded-2xl p-6 text-white">
              <h3 className="font-display text-lg font-semibold mb-2">Precinct Passport</h3>
              <p className="text-rhip-ice text-sm mb-4">Track your event attendance and earn rewards.</p>
              <Link to="/passport" className="text-rhip-teal text-sm hover:underline">View passport →</Link>
            </div>
          </>
        )}

        {user?.role === ROLES.INDUSTRY && (
          <>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-4">Latest Challenges</h3>
              <ul className="space-y-2">
                {(stats.challenges || []).map((c) => (
                  <li key={c.id} className="text-sm text-rhip-body">{c.title}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-4">Commercial Projects</h3>
              <ul className="space-y-2">
                {(stats.projects || []).map((p) => (
                  <li key={p.id} className="text-sm text-rhip-body">{p.title}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {user?.role === ROLES.INVESTOR && (
          <>
            <div className="bg-rhip-dark rounded-2xl p-6 text-white md:col-span-2">
              <h3 className="font-display text-lg font-semibold mb-2">Investor Portal</h3>
              <p className="text-rhip-ice text-sm mb-4">
                Explore precinct metrics, the investable pipeline, and HTH opportunities.
              </p>
              <Link to="/investor" className="text-rhip-teal text-sm hover:underline">
                Open investor portal →
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-2">Investable Projects</h3>
              <p className="font-display text-3xl font-bold text-rhip-teal">{stats.investableCount ?? 0}</p>
              <Link to="/investor" className="text-sm text-rhip-teal hover:underline mt-2 inline-block">
                View pipeline →
              </Link>
            </div>
            {stats.hthOccupancy && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold text-rhip-dark mb-2">HTH Occupancy</h3>
                <p className="font-display text-3xl font-bold text-rhip-teal">{stats.hthOccupancy.display_value}</p>
                <div className="h-2 bg-rhip-cardBg rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-rhip-teal rounded-full"
                    style={{ width: `${stats.hthOccupancy.value}%` }}
                  />
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-4">Key Metrics</h3>
              <ul className="space-y-2">
                {(stats.kpis || []).map((k) => (
                  <li key={k.id} className="flex justify-between text-sm text-rhip-body">
                    <span>{k.display_label}</span>
                    <span className="font-medium text-rhip-teal">{k.display_value}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-4">Top Pipeline Projects</h3>
              <ul className="space-y-2">
                {(stats.topProjects || []).map((p) => (
                  <li key={p.id} className="text-sm text-rhip-body">{p.title}</li>
                ))}
                {(stats.topProjects || []).length === 0 && (
                  <li className="text-sm text-rhip-muted">No projects available.</li>
                )}
              </ul>
            </div>
          </>
        )}

        {user?.role === ROLES.ADMIN && (
          <>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-2">Challenges Pending Matching</h3>
              <p className="font-display text-3xl font-bold text-rhip-teal">{stats.pending ?? 0}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-2">Active Users by Role</h3>
              <ul className="space-y-1 text-sm">
                {Object.entries(stats.userCounts || {}).map(([role, count]) => (
                  <li key={role} className="flex justify-between text-rhip-body">
                    <span>{ROLE_LABELS[role] || role}</span>
                    <span className="font-medium text-rhip-teal">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-2">Enquiries</h3>
              <p className="font-display text-3xl font-bold text-rhip-teal">{stats.enquiryCount ?? 0}</p>
              <Link to="/admin" className="text-sm text-rhip-teal hover:underline mt-2 inline-block">
                View enquiries →
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-2">Upcoming Events (30 days)</h3>
              <p className="font-display text-3xl font-bold text-rhip-teal">{stats.upcomingEvents ?? 0}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-2">Total KPIs</h3>
              <p className="font-display text-3xl font-bold text-rhip-teal">{stats.kpiCount ?? 0}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-4">Quick Links</h3>
              <div className="space-y-2 text-sm">
                <Link to="/directory" className="block text-rhip-teal hover:underline">Directory</Link>
                <Link to="/challenges" className="block text-rhip-teal hover:underline">Challenges</Link>
                <Link to="/admin" className="block text-rhip-teal hover:underline">Admin Panel</Link>
              </div>
            </div>
          </>
        )}

        {user?.role !== ROLES.INVESTOR && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-rhip-dark mb-4">Quick Navigation</h3>
          <div className="space-y-2 text-sm">
            <Link to="/directory" className="block text-rhip-teal hover:underline">Expertise Directory</Link>
            <Link to="/challenges" className="block text-rhip-teal hover:underline">Challenge Board</Link>
            <Link to="/pipeline" className="block text-rhip-teal hover:underline">Innovation Pipeline</Link>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
