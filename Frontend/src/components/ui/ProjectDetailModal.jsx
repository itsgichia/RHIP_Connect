import { useEffect, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import api from '../../hooks/useApi'
import ProjectInvestForm from '../forms/ProjectInvestForm'
import { formatAud, formatDuration, formatStartDate } from '../../utils/formatters'
import { trlBadgeClass, trlFullLabel, trlShortLabel } from '../../utils/trl'
import {
  formatIllustrativeMultiple,
  indicativeBandClass,
  indicativeBandLabel,
} from '../../utils/roi'

export default function ProjectDetailModal({ projectId, onClose, onInvested }) {
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get(`/investor/projects/${projectId}`)
        if (!cancelled) setProject(data)
      } catch {
        if (!cancelled) setError('Unable to load project details.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [projectId])

  const handleInvested = (amount) => {
    setProject((prev) => {
      if (!prev) return prev
      const raised = (prev.funding_raised || 0) + amount
      const goal = prev.funding_goal || 0
      return {
        ...prev,
        funding_raised: raised,
        funding_progress_pct: goal > 0 ? Math.round((raised / goal) * 1000) / 10 : 0,
        investor_count: (prev.investor_count || 0) + 1,
      }
    })
    onInvested?.(projectId, amount)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4 z-10">
          <div>
            {loading ? (
              <div className="h-7 w-64 bg-gray-100 rounded animate-pulse" />
            ) : project ? (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${trlBadgeClass(project.trl)}`}>
                    {trlShortLabel(project.trl)}
                  </span>
                  <span className="text-xs text-rhip-muted">
                    {project.trl_label || trlFullLabel(project.trl)}
                  </span>
                </div>
                <h2 className="font-display text-xl font-semibold text-rhip-dark">{project.title}</h2>
              </>
            ) : (
              <h2 className="font-display text-xl font-semibold text-rhip-dark">Project details</h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-rhip-muted hover:text-rhip-dark shrink-0"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          {loading && (
            <div className="space-y-4">
              <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
              <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          )}

          {error && <p className="text-rhip-muted text-center py-8">{error}</p>}

          {project && !loading && (
            <>
              <p className="text-rhip-body leading-relaxed">{project.description}</p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-rhip-lightBg rounded-xl p-4">
                  <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide mb-1">
                    Invested to date
                  </p>
                  <p className="font-display text-2xl font-bold text-rhip-teal">
                    {formatAud(project.funding_raised)}
                  </p>
                  <p className="text-xs text-rhip-muted mt-1">
                    of {formatAud(project.funding_goal)} goal
                    {project.investor_count > 0 && ` · ${project.investor_count} investor${project.investor_count === 1 ? '' : 's'}`}
                  </p>
                  <div className="h-2 bg-white rounded-full overflow-hidden mt-3">
                    <div
                      className="h-full bg-rhip-teal rounded-full transition-all"
                      style={{ width: `${Math.min(project.funding_progress_pct, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-rhip-muted mt-1">{project.funding_progress_pct}% funded</p>
                </div>

                <div className="bg-rhip-lightBg rounded-xl p-4">
                  <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide mb-1">
                    Project duration
                  </p>
                  <p className="font-display text-2xl font-bold text-rhip-teal">
                    {formatDuration(project.duration_months)}
                  </p>
                  {project.started_at && (
                    <p className="text-xs text-rhip-muted mt-1">
                      Started {formatStartDate(project.started_at)}
                    </p>
                  )}
                  <div className="mt-3 space-y-1 text-sm text-rhip-body">
                    <p><span className="text-rhip-muted">Specialty:</span> {project.specialty_area}</p>
                    {project.lead_researcher_name && (
                      <p><span className="text-rhip-muted">Lead:</span> {project.lead_researcher_name}</p>
                    )}
                  </div>
                </div>
              </div>

              {project.indicative_score != null && (
                <div className="rounded-xl border border-rhip-border p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide mb-1">
                        Indicative investment outlook
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${indicativeBandClass(
                            project.indicative_band
                          )}`}
                        >
                          {indicativeBandLabel(project.indicative_band)}
                        </span>
                        <span className="font-display text-2xl font-bold text-rhip-dark">
                          {Math.round(project.indicative_score)}
                          <span className="text-sm font-medium text-rhip-muted"> / 100</span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-rhip-muted mb-1">Illustrative multiple</p>
                      <p className="font-display text-xl font-semibold text-rhip-teal">
                        {formatIllustrativeMultiple(project.illustrative_multiple)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(project.roi_components || []).map((c) => (
                      <div key={c.key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-rhip-dark">{c.label}</span>
                          <span className="text-rhip-muted">
                            {c.points} / {c.max_points}
                          </span>
                        </div>
                        <div className="h-1.5 bg-rhip-lightBg rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rhip-teal rounded-full"
                            style={{
                              width: `${Math.min((c.points / c.max_points) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-rhip-muted mt-1">{c.detail}</p>
                      </div>
                    ))}
                  </div>

                  {project.impact_link && (
                    <div className="text-xs text-rhip-body bg-rhip-lightTeal/50 rounded-lg px-3 py-2 space-y-1">
                      <p className="font-medium text-rhip-dark">
                        Documented impact
                        {project.impact_link.evidence_level
                          ? ` · ${project.impact_link.evidence_level}`
                          : ''}
                      </p>
                      <p>
                        {project.impact_link.patients_helped.toLocaleString()} patients ·{' '}
                        {project.impact_link.time_saved_days || 0} days saved ·{' '}
                        {formatAud(project.impact_link.cost_reduced_aud)} cost reduced
                      </p>
                      {project.impact_link.evidence_note && (
                        <p className="text-rhip-muted">{project.impact_link.evidence_note}</p>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-rhip-muted leading-relaxed">
                    {project.roi_disclaimer}
                  </p>
                </div>
              )}

              {project.funding_breakdown?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-rhip-dark mb-3">Funding breakdown</h3>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-rhip-lightBg text-left">
                        <tr>
                          <th className="px-4 py-2 font-medium text-rhip-muted">Category</th>
                          <th className="px-4 py-2 font-medium text-rhip-muted text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {project.funding_breakdown.map((item) => (
                          <tr key={item.label}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-rhip-dark">{item.label}</p>
                              {item.description && (
                                <p className="text-xs text-rhip-muted mt-0.5">{item.description}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-rhip-teal whitespace-nowrap">
                              {formatAud(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-6">
                <ProjectInvestForm
                  projectId={project.id}
                  projectTitle={project.title}
                  onSuccess={handleInvested}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
