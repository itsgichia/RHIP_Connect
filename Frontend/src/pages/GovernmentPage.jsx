import { useCallback, useEffect, useState } from 'react'
import {
  ChartBarIcon,
  DocumentArrowDownIcon,
  BeakerIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import api from '../hooks/useApi'
import PublicNavBar from '../components/layout/PublicNavBar'
import GovernmentNav from '../components/layout/GovernmentNav'
import StatCard from '../components/ui/StatCard'
import TranslationProjectCard from '../components/ui/TranslationProjectCard'
import KpiDetailModal from '../components/ui/KpiDetailModal'
import GovernmentProjectModal from '../components/ui/GovernmentProjectModal'
import GovernmentBriefingForm from '../components/forms/GovernmentBriefingForm'
import TranslationJourney from '../components/ui/TranslationJourney'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

const HIGHLIGHT_METRICS = [
  'clinical_trials',
  'research_grants',
  'hospital_beds',
  'patient_interactions',
]

function OverviewTab({ data, onViewMetrics, onViewPipeline, onViewStories, onExport }) {
  const highlights = data.kpis.filter((k) => HIGHLIGHT_METRICS.includes(k.metric_name))

  return (
    <div className="space-y-6">
      <div className="bg-rhip-dark rounded-2xl p-8 text-white">
        <h2 className="font-display text-2xl font-semibold mb-2">Precinct Impact Dashboard</h2>
        <p className="text-rhip-ice max-w-2xl">
          Public transparency on health system capacity, research activity, and translation
          pipeline — for NSW Health, SESLHD, council, and policy teams. No login required.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {highlights.map((kpi) => (
          <StatCard key={kpi.id} label={kpi.display_label} value={kpi.display_value} />
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <ChartBarIcon className="w-8 h-8 text-rhip-teal mb-3" />
          <h3 className="font-semibold text-rhip-dark mb-2">Impact Metrics</h3>
          <p className="text-sm text-rhip-muted mb-4">
            Click any KPI for breakdowns, facility splits, and 5-year trends.
          </p>
          <button
            type="button"
            onClick={onViewMetrics}
            className="text-sm text-rhip-teal hover:underline"
          >
            Explore metrics →
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <BeakerIcon className="w-8 h-8 text-rhip-teal mb-3" />
          <h3 className="font-semibold text-rhip-dark mb-2">Translation Pipeline</h3>
          <p className="font-display text-3xl font-bold text-rhip-teal mb-2">
            {data.translation_count}
          </p>
          <p className="text-sm text-rhip-muted mb-4">
            Public innovation projects from feasibility through clinical adoption.
          </p>
          <button
            type="button"
            onClick={onViewPipeline}
            className="text-sm text-rhip-teal hover:underline"
          >
            View pipeline →
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <SparklesIcon className="w-8 h-8 text-rhip-teal mb-3" />
          <h3 className="font-semibold text-rhip-dark mb-2">Success Stories</h3>
          <p className="text-sm text-rhip-muted mb-4">
            Challenge → research match → pipeline → clinical impact, with outcome metrics.
          </p>
          <button
            type="button"
            onClick={onViewStories}
            className="text-sm text-rhip-teal hover:underline"
          >
            View journeys →
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <DocumentArrowDownIcon className="w-8 h-8 text-rhip-teal mb-3" />
          <h3 className="font-semibold text-rhip-dark mb-2">Impact Snapshot</h3>
          <p className="text-sm text-rhip-muted mb-4">
            Download a CSV of current KPIs and translation projects for board papers
            and briefings.
          </p>
          <button
            type="button"
            onClick={onExport}
            className="text-sm text-rhip-teal hover:underline"
          >
            Export snapshot ↓
          </button>
        </div>
      </div>
    </div>
  )
}

function MetricsTab({ kpis, onKpiClick }) {
  return (
    <div>
      <p className="text-sm text-rhip-muted mb-6">
        Click any metric to view breakdowns by facility, specialty, or funding source,
        plus historical trends.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <button
            key={kpi.id}
            type="button"
            onClick={() => onKpiClick(kpi.metric_name)}
            className="bg-white rounded-2xl p-6 shadow-sm text-center hover:shadow-md hover:ring-2 hover:ring-rhip-teal/30 transition-all focus:outline-none focus:ring-2 focus:ring-rhip-teal/40"
          >
            <p className="font-display text-2xl font-bold text-rhip-teal mb-1">
              {kpi.display_value}
            </p>
            <p className="text-sm text-rhip-muted">{kpi.display_label}</p>
            {kpi.unit === '%' && (
              <div className="mt-3 h-2 bg-rhip-cardBg rounded-full overflow-hidden">
                <div
                  className="h-full bg-rhip-teal rounded-full"
                  style={{ width: `${kpi.value}%` }}
                />
              </div>
            )}
            <p className="text-xs text-rhip-teal mt-3">View breakdown →</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function PipelineTab({ projects }) {
  const [readiness, setReadiness] = useState('all')
  const [selectedProjectId, setSelectedProjectId] = useState(null)

  const filtered = readiness === 'all'
    ? projects
    : projects.filter((p) => p.readiness === readiness)

  return (
    <div>
      <p className="text-sm text-rhip-muted mb-4">
        Research-to-care translation projects — view progress toward clinical adoption,
        not investment details.
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
          <TranslationProjectCard
            key={p.id}
            project={p}
            onClick={() => setSelectedProjectId(p.id)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-rhip-muted col-span-full text-center py-12">
            No projects match the selected filter.
          </p>
        )}
      </div>

      {selectedProjectId && (
        <GovernmentProjectModal
          projectId={selectedProjectId}
          onClose={() => setSelectedProjectId(null)}
        />
      )}
    </div>
  )
}

function BriefingTab() {
  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <GovernmentBriefingForm />
      </div>
    </div>
  )
}

export default function GovernmentPage() {
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState(null)
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedKpi, setSelectedKpi] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: overview }, storiesRes] = await Promise.all([
        api.get('/government/overview'),
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
    loadData()
  }, [loadData])

  const handleExport = () => {
    window.open(`${API_BASE}/government/export`, '_blank')
  }

  return (
    <div className="min-h-screen bg-rhip-lightBg">
      <PublicNavBar />

      <section className="bg-rhip-dark px-6 py-16 md:py-20">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-rhip-teal text-sm font-medium uppercase tracking-wide mb-3">
            For Government
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
            Precinct Impact &amp; Accountability
          </h1>
          <p className="text-rhip-ice text-base md:text-lg max-w-2xl mx-auto">
            Transparent metrics on health capacity, research activity, and translation
            to care — built from live precinct data.
          </p>
        </div>
      </section>

      <GovernmentNav activeTab={tab} onTabChange={setTab} />

      <main className="max-w-6xl mx-auto px-6 py-10">
        {loading && <p className="text-rhip-muted">Loading impact data…</p>}

        {!loading && !data && tab !== 'stories' && tab !== 'briefing' && (
          <p className="text-rhip-muted">Unable to load government data. Please try again later.</p>
        )}

        {data && tab === 'overview' && (
          <OverviewTab
            data={data}
            onViewMetrics={() => setTab('metrics')}
            onViewPipeline={() => setTab('pipeline')}
            onViewStories={() => setTab('stories')}
            onExport={handleExport}
          />
        )}
        {data && tab === 'metrics' && (
          <MetricsTab kpis={data.kpis} onKpiClick={setSelectedKpi} />
        )}
        {data && tab === 'pipeline' && <PipelineTab projects={data.projects} />}
        {tab === 'stories' && (
          <div>
            <p className="text-sm text-rhip-muted mb-6">
              End-to-end translation journeys — from clinical challenge to measurable impact.
            </p>
            <TranslationJourney stories={stories} />
          </div>
        )}
        {tab === 'briefing' && <BriefingTab />}
      </main>

      {selectedKpi && (
        <KpiDetailModal metricName={selectedKpi} onClose={() => setSelectedKpi(null)} />
      )}
    </div>
  )
}
