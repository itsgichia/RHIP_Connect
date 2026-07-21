import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { isInvestor } from '../utils/roles'
import StatCard from '../components/ui/StatCard'
import ProjectCard from '../components/ui/ProjectCard'
import ProjectDetailModal from '../components/ui/ProjectDetailModal'
import InvestorContactForm from '../components/forms/InvestorContactForm'
import TranslationJourney from '../components/ui/TranslationJourney'
import { TRL_FILTERS, matchesTrlFilter } from '../utils/trl'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'stories', label: 'Success Stories' },
  { key: 'hth', label: 'Health Translation Hub' },
  { key: 'contact', label: 'Contact' },
]

const BENEFITS = [
  'Access to a pipeline of 24+ investable projects',
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

function OverviewTab({ data, onViewPipeline, onViewStories }) {
  const { kpis, hth_occupancy, investable_count } = data
  const highlights = kpis.filter((k) =>
    ['active_innovation_projects', 'hth_occupancy', 'spinouts', 'industry_partnerships'].includes(k.metric_name)
  )

  return (
    <div className="space-y-6">
      <div className="bg-rhip-dark rounded-2xl p-8 text-white border border-rhip-sidebar-border">
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

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-rhip-dark mb-2">Investable Projects</h3>
          <p className="font-display text-4xl font-bold text-rhip-teal mb-2">{investable_count}</p>
          <p className="text-sm text-rhip-muted mb-4">
            Ranked by indicative outlook score — TRL, readiness, capital progress, and impact
            evidence. Open a project for the full breakdown.
          </p>
          <button
            type="button"
            onClick={onViewPipeline}
            className="text-sm text-rhip-teal hover:underline"
          >
            Browse by outlook →
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-rhip-dark mb-2">Success Stories</h3>
          <p className="text-sm text-rhip-muted mb-4">
            Translation journeys with patients helped, time saved, cost reduced, and TRL progress —
            proof that precinct projects move from challenge to impact.
          </p>
          <button
            type="button"
            onClick={onViewStories}
            className="text-sm text-rhip-teal hover:underline"
          >
            View impact stories →
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

function PipelineTab({ projects, onProjectUpdate, roiDisclaimer }) {
  const [trlFilter, setTrlFilter] = useState('all')
  const [sortBy, setSortBy] = useState('score')
  const [selectedProjectId, setSelectedProjectId] = useState(null)

  const filtered = projects
    .filter((p) => matchesTrlFilter(p.trl, trlFilter))
    .slice()
    .sort((a, b) => {
      if (sortBy === 'trl') return (b.trl || 0) - (a.trl || 0)
      if (sortBy === 'funding') {
        const ap = a.funding_goal > 0 ? a.funding_raised / a.funding_goal : 0
        const bp = b.funding_goal > 0 ? b.funding_raised / b.funding_goal : 0
        return bp - ap
      }
      return (b.indicative_score || 0) - (a.indicative_score || 0)
    })

  const handleInvested = (projectId, amount) => {
    onProjectUpdate?.(projectId, amount)
  }

  return (
    <div>
      <p className="text-sm text-rhip-muted mb-3">
        Compare investable projects by indicative outlook score (translation readiness, capital
        progress, and impact evidence). Not a financial forecast.
      </p>
      {roiDisclaimer && (
        <p className="text-xs text-rhip-muted bg-white border border-rhip-border rounded-xl px-4 py-3 mb-5 leading-relaxed">
          {roiDisclaimer}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-medium text-rhip-muted uppercase tracking-wide mr-1">Sort</span>
        {[
          { key: 'score', label: 'Indicative score' },
          { key: 'trl', label: 'TRL' },
          { key: 'funding', label: 'Funding progress' },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSortBy(opt.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              sortBy === opt.key
                ? 'bg-rhip-teal text-white'
                : 'bg-white text-rhip-body border border-gray-200 hover:border-rhip-teal/40'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        {TRL_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setTrlFilter(f.key)}
            className={`px-4 py-3 rounded-xl text-left transition-colors ${
              trlFilter === f.key
                ? 'bg-rhip-teal text-white'
                : 'bg-white text-rhip-body border border-gray-200 hover:border-rhip-teal/40'
            }`}
          >
            <span className="block text-sm font-semibold">{f.label}</span>
            {f.trlRange && (
              <span
                className={`block text-xs mt-0.5 ${
                  trlFilter === f.key ? 'text-white/80' : 'text-rhip-muted'
                }`}
              >
                {f.trlRange}
              </span>
            )}
            <span
              className={`block text-xs mt-1 leading-snug ${
                trlFilter === f.key ? 'text-white/90' : 'text-rhip-muted'
              }`}
            >
              {f.description}
            </span>
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            onClick={() => setSelectedProjectId(p.id)}
            showStageBand
            showIndicativeRoi
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-rhip-muted col-span-full text-center py-12">
            No projects match the selected filter.
          </p>
        )}
      </div>

      {selectedProjectId && (
        <ProjectDetailModal
          projectId={selectedProjectId}
          onClose={() => setSelectedProjectId(null)}
          onInvested={handleInvested}
        />
      )}
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
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: overview }, storiesRes] = await Promise.all([
        api.get('/investor/overview'),
        api.get('/pulse/stories').catch(() => ({ data: { stories: [] } })),
      ])
      setData(overview)
      setStories(storiesRes.data.stories || [])
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isInvestor(user?.role)) loadData()
  }, [user, loadData])

  const handleProjectInvested = (projectId, amount) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        projects: prev.projects.map((p) => {
          if (p.id !== projectId) return p
          const raised = (p.funding_raised || 0) + amount
          return { ...p, funding_raised: raised }
        }),
      }
    })
  }

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

      {tab === 'overview' && (
        <OverviewTab
          data={data}
          onViewPipeline={() => setTab('pipeline')}
          onViewStories={() => setTab('stories')}
        />
      )}
      {tab === 'metrics' && <MetricsTab kpis={data.kpis} />}
      {tab === 'pipeline' && (
        <PipelineTab
          projects={data.projects}
          onProjectUpdate={handleProjectInvested}
          roiDisclaimer={data.roi_disclaimer}
        />
      )}
      {tab === 'stories' && (
        <div>
          <p className="text-sm text-rhip-muted mb-6">
            Proven translation journeys — clinical challenge to commercial outcome, with impact
            metrics investors can cite.
          </p>
          <TranslationJourney stories={stories} />
        </div>
      )}
      {tab === 'hth' && <HthTab hthOccupancy={data.hth_occupancy} />}
      {tab === 'contact' && <ContactTab user={user} />}
    </div>
  )
}
