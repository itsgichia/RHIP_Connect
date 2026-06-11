import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS, ROLES } from '../utils/roles'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({})

  useEffect(() => {
    const load = async () => {
      const results = {}
      try {
        if (user?.role === ROLES.CLINICIAN || user?.role === ROLES.RESEARCHER) {
          const { data } = await api.get('/challenges')
          const mine = data.challenges.filter(
            (c) => c.posted_by?.name === user.name || user.role === ROLES.RESEARCHER
          )
          results.challenges = mine.slice(0, 5)
        }
        if (user?.role === ROLES.INDUSTRY) {
          const { data } = await api.get('/challenges')
          results.challenges = data.challenges.slice(0, 5)
          const proj = await api.get('/pipeline/projects?readiness=commercial')
          results.projects = proj.data.projects.slice(0, 3)
        }
        if (user?.role === ROLES.ADMIN) {
          const { data } = await api.get('/challenges')
          results.pending = data.challenges.filter((c) => c.status === 'pending' || c.status === 'matching').length
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
              <h3 className="font-semibold text-rhip-dark mb-4">Recent Challenges</h3>
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

        {user?.role === ROLES.ADMIN && (
          <>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-rhip-dark mb-2">Challenges Pending Matching</h3>
              <p className="font-display text-3xl font-bold text-rhip-teal">{stats.pending ?? 0}</p>
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

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-rhip-dark mb-4">Quick Navigation</h3>
          <div className="space-y-2 text-sm">
            <Link to="/directory" className="block text-rhip-teal hover:underline">Expertise Directory</Link>
            <Link to="/challenges" className="block text-rhip-teal hover:underline">Challenge Board</Link>
            <Link to="/pipeline" className="block text-rhip-teal hover:underline">Innovation Pipeline</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
