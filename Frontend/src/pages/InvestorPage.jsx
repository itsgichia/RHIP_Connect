import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { isInvestor } from '../utils/roles'
import StatCard from '../components/ui/StatCard'
import ProjectCard from '../components/ui/ProjectCard'
import InvestorContactForm from '../components/forms/InvestorContactForm'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'hth', label: 'Health Translation Hub' },
  { key: 'contact', label: 'Contact' },
]

const BENEFITS = [
  'Access to a pipeline of 15+ investable projects',
  'Co-location in the Health Translation Hub',
  'Direct clinical trial partnerships',
  'IP licensing opportunities',
  'A 7,000-strong research talent pool',
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

function OverviewTab({ data, onViewPipeline }) {
  const { kpis, hth_occupancy, investable_count } = data
  const highlights = kpis.filter((k) =>
    ['active_innovation_projects', 'hth_occupancy', 'spinouts', 'industry_partnerships'].includes(k.metric_name)
  )

  return (
    <div className="space-y-6">
      <div className="bg-rhip-dark rounded-2xl p-8 text-white">
        <h2 className="font-display text-2xl font-semibold mb-2">Welcome to RHIP Connect</h2>
        <p className="text-rhip-ice max-w-2xl">
          Explore the Randwick Health &amp; Innovation Precinct — clinical scale, research capability,
          and infrastructure unmatched in the Southern Hemisphere.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {highlights.map((kpi) => (
          <StatCard key={kpi.id} label={kpi.display_label} value={kpi.display_value} />
        ))}
        {!highlights.length && (
          <div className="col-span-full text-sm text-rhip-muted">Loading metrics…</div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-rhip-dark mb-2">Investable Projects</h3>
          <p className="font-display text-4xl font-bold text-rhip-teal mb-2">{investable_count}</p>
          <p className="text-sm text-rhip-muted mb-4">
            Public-stage innovation projects from feasibility through approval.
          </p>
          <button
            type="button"
            onClick={onViewPipeline}
            className="text-sm text-rhip-teal hover:underline"
          >
            Browse pipeline →
          </button>
        </div>

        {hth_occupancy && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-rhip-dark mb-2">HTH Occupancy</h3>
            <p className="font-display text-4xl font-bold text-rhip-teal mb-2">{hth_occupancy.display_value}</p>
            <div className="h-3 bg-rhip-cardBg rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-rhip-teal rounded-full"
                style={{ width: `${hth_occupancy.value}%` }}
              />
            </div>
            <p className="text-sm text-rhip-muted">6 industry floors · 2 floors currently available</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-semibold text-rhip-dark mb-4">What RHIP Offers Investors</h3>
        <ul className="grid sm:grid-cols-2 gap-3">
          {BENEFITS.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-rhip-body">
              <span className="text-rhip-teal mt-0.5">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function MetricsTab({ kpis }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpis.map((kpi) => (
        <div key={kpi.id} className="bg-white rounded-2xl p-6 shadow-sm">
          <p className="font-display text-3xl font-bold text-rhip-teal mb-1">{kpi.display_value}</p>
          <p className="text-sm font-medium text-rhip-dark">{kpi.display_label}</p>
          <p className="text-xs text-rhip-muted mt-2 capitalize">{kpi.category} · {kpi.period}</p>
          {kpi.metric_name === 'hth_occupancy' && (
            <div className="h-2 bg-rhip-cardBg rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-rhip-teal rounded-full"
                style={{ width: `${kpi.value}%` }}
              />
            </div>
          )}
        </div>
      ))}
      {kpis.length === 0 && (
        <p className="text-rhip-muted col-span-full text-center py-8">No metrics available.</p>
      )}
    </div>
  )
}

function PipelineTab({ projects }) {
  const [readiness, setReadiness] = useState('all')
  const filtered = readiness === 'all'
    ? projects
    : projects.filter((p) => p.readiness === readiness)

  return (
    <div>
      <p className="text-sm text-rhip-muted mb-4">
        Public innovation projects at feasibility stage and beyond — the investable pipeline.
      </p>
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'all', label: 'All' },
          { key: 'feasibility', label: 'Feasibility' },
          { key: 'clinical', label: 'Clinical' },
          { key: 'commercial', label: 'Commercial' },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setReadiness(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              readiness === f.key
                ? 'bg-rhip-teal text-white'
                : 'bg-white text-rhip-body border border-gray-200 hover:border-rhip-teal/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
        {filtered.length === 0 && (
          <p className="text-rhip-muted col-span-full text-center py-12">
            No projects match the selected filter.
          </p>
        )}
      </div>
    </div>
  )
}

function HthTab({ hthOccupancy }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-display text-xl font-semibold text-rhip-dark mb-2">
          The Health Translation Hub
        </h3>
        <p className="text-sm text-rhip-muted mb-4">Opened: 2025 · 35,000 m² · $600M investment</p>
        <p className="text-rhip-body leading-relaxed mb-4">
          Six dedicated industry floors designed for co-location with the precinct&apos;s hospitals
          and research institutes. Where discovery meets clinical practice.
        </p>
        <p className="text-sm text-rhip-muted">
          6 industry floors · Startup space · Education facilities · 35,000m² · Direct hospital connectivity
        </p>
      </div>
      <div className="bg-rhip-lightTeal rounded-2xl p-6">
        {hthOccupancy ? (
          <>
            <p className="text-sm font-medium text-rhip-body mb-2">Current Occupancy</p>
            <p className="font-display text-4xl font-bold text-rhip-teal mb-3">
              {hthOccupancy.display_value}
            </p>
            <div className="h-4 bg-white rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-rhip-teal rounded-full"
                style={{ width: `${hthOccupancy.value}%` }}
              />
            </div>
            <p className="text-sm text-rhip-muted">6 industry floors</p>
            <p className="text-xs text-rhip-muted mt-2">2 floors currently available for tenancy</p>
          </>
        ) : (
          <p className="text-rhip-muted">Occupancy data unavailable.</p>
        )}
      </div>
    </div>
  )
}

function ContactTab({ user }) {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h3 className="font-display text-xl font-semibold text-rhip-dark mb-4">Partner With Us</h3>
        <p className="text-rhip-body leading-relaxed mb-6">
          RHIP brings together the clinical scale, research capability, and infrastructure that
          industry and investors cannot access anywhere else in the Southern Hemisphere.
        </p>
        <ul className="space-y-2 text-sm text-rhip-body">
          {BENEFITS.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-rhip-teal">✓</span> {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <InvestorContactForm
          defaultValues={{ name: user?.name, email: user?.email }}
        />
      </div>
    </div>
  )
}

export default function InvestorPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: overview } = await api.get('/investor/overview')
      setData(overview)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isInvestor(user?.role)) loadData()
  }, [user, loadData])

  if (!isInvestor(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  if (loading) {
    return <p className="text-rhip-muted">Loading investor portal…</p>
  }

  if (!data) {
    return <p className="text-rhip-muted">Unable to load investor data. Please try again later.</p>
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-2">Investor Portal</h1>
      <p className="text-rhip-muted mb-6">
        Precinct performance, investable pipeline, and partnership opportunities.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'pipeline' && data.investable_count > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs bg-white/20 rounded-full">
                {data.investable_count}
              </span>
            )}
          </TabButton>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab data={data} onViewPipeline={() => setTab('pipeline')} />}
      {tab === 'metrics' && <MetricsTab kpis={data.kpis} />}
      {tab === 'pipeline' && <PipelineTab projects={data.projects} />}
      {tab === 'hth' && <HthTab hthOccupancy={data.hth_occupancy} />}
      {tab === 'contact' && <ContactTab user={user} />}
    </div>
  )
}
