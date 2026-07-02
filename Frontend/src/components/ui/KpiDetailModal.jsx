import { useEffect, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import api from '../../hooks/useApi'

export default function KpiDetailModal({ metricName, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!metricName) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get(`/government/kpis/${metricName}`)
        if (!cancelled) setDetail(data)
      } catch {
        if (!cancelled) setError('Unable to load metric details.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [metricName])

  const maxTrend = detail?.trend?.length
    ? Math.max(...detail.trend.map((p) => p.value))
    : 0

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
              <div className="h-7 w-48 bg-gray-100 rounded animate-pulse" />
            ) : detail ? (
              <>
                <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide mb-1">
                  Impact metric
                </p>
                <h2 className="font-display text-xl font-semibold text-rhip-dark">
                  {detail.kpi.display_label}
                </h2>
                <p className="font-display text-3xl font-bold text-rhip-teal mt-1">
                  {detail.kpi.display_value}
                </p>
              </>
            ) : (
              <h2 className="font-display text-xl font-semibold text-rhip-dark">Metric details</h2>
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
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
              <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          )}

          {error && <p className="text-rhip-muted text-center py-8">{error}</p>}

          {detail && !loading && (
            <>
              <p className="text-rhip-body leading-relaxed">{detail.summary}</p>

              {detail.breakdown.length > 0 && (
                <div>
                  <h3 className="font-semibold text-rhip-dark mb-3">Breakdown</h3>
                  <div className="space-y-3">
                    {detail.breakdown.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-start justify-between gap-4 p-4 bg-rhip-lightBg rounded-xl"
                      >
                        <div>
                          <p className="font-medium text-rhip-dark text-sm">{item.label}</p>
                          {item.description && (
                            <p className="text-xs text-rhip-muted mt-0.5">{item.description}</p>
                          )}
                        </div>
                        <p className="font-display font-bold text-rhip-teal whitespace-nowrap">
                          {item.display_value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.trend.length > 0 && (
                <div>
                  <h3 className="font-semibold text-rhip-dark mb-3">5-year trend</h3>
                  <div className="flex items-end gap-2 h-32 px-2">
                    {detail.trend.map((point) => (
                      <div key={point.year} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-medium text-rhip-teal">
                          {point.display_value}
                        </span>
                        <div
                          className="w-full bg-rhip-teal rounded-t-md transition-all"
                          style={{
                            height: `${maxTrend > 0 ? (point.value / maxTrend) * 100 : 0}%`,
                            minHeight: '4px',
                          }}
                        />
                        <span className="text-xs text-rhip-muted">{point.year}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-rhip-muted">
                Reporting period: {detail.kpi.period} · Category: {detail.kpi.category}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
