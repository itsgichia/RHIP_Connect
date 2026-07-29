import { useEffect, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import api from '../../hooks/useApi'
import { formatAud, formatStartDate } from '../../utils/formatters'
import { trlBadgeClass, trlFullLabel, trlShortLabel } from '../../utils/trl'

const STAGE_LABELS = {
  1: 'Need',
  2: 'Idea',
  3: 'PoC',
  4: 'Feasibility',
  5: 'Proof of Value',
  6: 'Initial Trials',
  7: 'Validation',
  8: 'Approval',
  9: 'Clinical Use',
  10: 'Standard of Care',
}

export default function PipelineProjectModal({ projectId, onClose }) {
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
        const { data } = await api.get(`/pipeline/projects/${projectId}`)
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

  const stageLabel = project ? STAGE_LABELS[project.stage] || `Stage ${project.stage}` : ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4">
          <div>
            {loading ? (
              <div className="h-7 w-64 bg-gray-100 rounded animate-pulse" />
            ) : project ? (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-rhip-navy text-white">
                    Stage {project.stage} · {stageLabel}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${trlBadgeClass(project.trl)}`}>
                    {trlShortLabel(project.trl)}
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

        <div className="px-6 py-6 space-y-5">
          {loading && (
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
              <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          )}

          {error && <p className="text-rhip-muted text-center py-8">{error}</p>}

          {project && !loading && (
            <>
              <p className="text-rhip-body leading-relaxed">{project.description}</p>

              <div className="bg-rhip-lightBg rounded-xl p-4">
                <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide mb-1">
                  Technology readiness
                </p>
                <p className="text-sm text-rhip-body">{project.trl_label || trlFullLabel(project.trl)}</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-rhip-lightBg rounded-xl p-4">
                  <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide mb-1">
                    Specialty area
                  </p>
                  <p className="font-medium text-rhip-dark text-sm">{project.specialty_area}</p>
                  {project.lead_researcher_name && (
                    <p className="text-xs text-rhip-muted mt-2">
                      Lead: {project.lead_researcher_name}
                    </p>
                  )}
                </div>
                <div className="bg-rhip-lightBg rounded-xl p-4">
                  <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide mb-1">
                    Readiness
                  </p>
                  <p className="font-medium text-rhip-dark text-sm capitalize">{project.readiness}</p>
                  {project.started_at && (
                    <p className="text-xs text-rhip-muted mt-2">
                      Started {formatStartDate(project.started_at)}
                    </p>
                  )}
                </div>
              </div>

              {(project.funding_goal > 0 || project.funding_raised > 0) && (
                <div className="bg-rhip-lightBg rounded-xl p-4">
                  <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide mb-2">
                    Funding
                  </p>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-rhip-muted">Raised</span>
                    <span className="font-medium text-rhip-teal">{formatAud(project.funding_raised)}</span>
                  </div>
                  {project.funding_goal > 0 && (
                    <>
                      <div className="h-2 bg-white rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rhip-teal rounded-full"
                          style={{
                            width: `${Math.min((project.funding_raised / project.funding_goal) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-rhip-muted mt-2">
                        Goal {formatAud(project.funding_goal)}
                      </p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
