import { useState } from 'react'

const PHASE_COLORS = {
  challenge: 'bg-rhip-coral',
  match: 'bg-rhip-teal',
  pipeline: 'bg-rhip-seafoam',
  clinical: 'bg-rhip-navy',
  outcome: 'bg-rhip-amber',
}

function formatAud(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function defaultMetrics(impact = {}) {
  return [
    {
      label: 'Patients helped',
      value: (impact.patients_helped || 0).toLocaleString(),
    },
    {
      label: 'Time saved',
      value: `${impact.time_saved_days || 0} days`,
    },
    {
      label: 'Cost reduced',
      value: formatAud(impact.cost_reduced_aud || 0),
    },
  ]
}

export default function TranslationJourney({ stories = [] }) {
  const [activeId, setActiveId] = useState(stories[0]?.id || null)
  const active = stories.find((s) => s.id === activeId) || stories[0]

  if (!stories.length) {
    return (
      <div className="rounded-2xl border border-rhip-border bg-white p-8 text-center text-rhip-muted">
        No success stories available.
      </div>
    )
  }

  const metrics =
    active?.impact_metrics?.length > 0
      ? active.impact_metrics
      : defaultMetrics(active?.impact)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {stories.map((story) => (
          <button
            key={story.id}
            type="button"
            onClick={() => setActiveId(story.id)}
            className={active?.id === story.id ? 'rhip-pill-active' : 'rhip-pill-inactive'}
          >
            {story.title.length > 36 ? `${story.title.slice(0, 34)}…` : story.title}
          </button>
        ))}
      </div>

      {active && (
        <div className="bg-white rounded-2xl border border-rhip-border overflow-hidden">
          <div className="bg-rhip-dark text-white p-6 md:p-8">
            <p className="text-xs uppercase tracking-wide text-rhip-ice mb-2">
              Translation journey · {active.specialty_area}
            </p>
            <h3 className="font-display text-2xl md:text-3xl font-semibold mb-2">{active.title}</h3>
            <p className="text-rhip-ice max-w-2xl">{active.tagline}</p>
            {active.partners?.length > 0 && (
              <p className="mt-4 text-sm text-rhip-ice/90 max-w-3xl">
                <span className="font-semibold text-white">Precinct partners: </span>
                {active.partners.join(' · ')}
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-4 p-5 border-b border-rhip-border bg-rhip-lightBg/60">
            {metrics.slice(0, 3).map((m) => (
              <div key={m.label}>
                <p className="text-xs uppercase tracking-wide text-rhip-muted mb-1">{m.label}</p>
                <p className="font-display text-2xl font-bold text-rhip-dark">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="p-5 md:p-6">
            <div className="flex items-center gap-3 mb-6 text-sm text-rhip-muted">
              <span>TRL {active.impact.trl_start}</span>
              <div className="flex-1 h-1.5 rounded-full bg-rhip-lightBg overflow-hidden">
                <div
                  className="h-full bg-rhip-teal rounded-full"
                  style={{
                    width: `${(active.impact.trl_end / 9) * 100}%`,
                  }}
                />
              </div>
              <span>TRL {active.impact.trl_end}</span>
            </div>

            <ol className="relative space-y-0 border-l-2 border-rhip-lightTeal ml-3">
              {active.milestones.map((m, i) => (
                <li key={`${m.phase}-${i}`} className="pl-6 pb-6 last:pb-0 relative">
                  <span
                    className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                      PHASE_COLORS[m.phase] || 'bg-rhip-teal'
                    }`}
                  />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                    <span className="text-sm font-semibold text-rhip-dark">{m.label}</span>
                    <span className="text-xs text-rhip-muted">{m.date}</span>
                  </div>
                  <p className="text-sm text-rhip-body leading-relaxed">{m.detail}</p>
                </li>
              ))}
            </ol>

            {active.sources?.length > 0 && (
              <p className="mt-6 pt-4 border-t border-rhip-border text-xs text-rhip-muted">
                Based on publicly reported precinct partner outcomes. See partner publications for full
                study details.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
