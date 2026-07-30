import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { XMarkIcon, MapPinIcon, LightBulbIcon } from '@heroicons/react/24/outline'
import RoleBadge from '../ui/RoleBadge'
import api from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import { canViewPipeline } from '../../utils/roles'

export default function MapFocusPanel({
  focus,
  insights = [],
  challengeId,
  onClose,
  onFocusPerson,
  onStartBridge,
  onExploreCommunity,
}) {
  const { user } = useAuth()
  const [, setSearchParams] = useSearchParams()
  const [briefing, setBriefing] = useState(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const showPipelineLinks = canViewPipeline(user?.role)

  useEffect(() => {
    if (!focus?.profile_id) return undefined
    let cancelled = false
    setBriefingLoading(true)
    setBriefing(null)
    const params = new URLSearchParams({ focus: focus.profile_id })
    if (challengeId) params.set('challenge', challengeId)
    api
      .get(`/map/briefing?${params}`)
      .then((res) => {
        if (!cancelled) setBriefing(res.data.briefing)
      })
      .catch(() => {
        if (!cancelled) setBriefing(null)
      })
      .finally(() => {
        if (!cancelled) setBriefingLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [focus?.profile_id, challengeId])

  if (!focus) return null

  const opportunityInsights = insights.filter((i) => i.type === 'opportunity')
  const matchContext = insights.find((i) => i.type === 'match_context')

  const focusPerson = (profileId) => {
    if (onFocusPerson) {
      onFocusPerson(profileId)
      return
    }
    const next = new URLSearchParams(window.location.search)
    next.set('focus', profileId)
    next.delete('from')
    next.delete('challenge')
    setSearchParams(next)
  }

  return (
    <aside className="bg-white rounded-2xl border border-rhip-border shadow-sm flex flex-col max-h-[min(720px,80vh)] overflow-hidden">
      <div className="px-5 py-4 border-b border-rhip-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-rhip-muted mb-1">Focus</p>
          <h2 className="font-display text-xl font-semibold text-rhip-dark truncate">
            {focus.name}
          </h2>
          <p className="text-sm text-rhip-muted mt-0.5">{focus.title}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <RoleBadge role={focus.role} facets={focus.identity_facets} />
            {focus.institution_name && (
              <span className="text-xs text-rhip-muted">{focus.institution_name}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-rhip-muted hover:bg-rhip-lightBg hover:text-rhip-dark transition-colors"
          aria-label="Back to landscape"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-4 overflow-y-auto space-y-5 text-sm">
        {focus.challenge && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
              Why they&apos;re here
            </h3>
            <p className="text-rhip-body">
              Matched for <span className="font-medium text-rhip-dark">{focus.challenge.title}</span>
            </p>
            {matchContext?.shared_topics?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {matchContext.shared_topics.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full bg-rhip-lightTeal text-rhip-teal text-xs"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {matchContext?.message && (
              <p className="text-xs text-rhip-muted mt-2">{matchContext.message}</p>
            )}
          </section>
        )}

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
            Map briefing
          </h3>
          {briefingLoading ? (
            <p className="text-rhip-muted text-sm animate-pulse">Anthropic is explaining this neighbourhood…</p>
          ) : briefing ? (
            <p className="text-rhip-body leading-relaxed">{briefing}</p>
          ) : (
            <p className="text-rhip-muted text-sm">
              Structural context for this person appears below.
            </p>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
            Position
          </h3>
          <p className="text-rhip-body mb-2">
            <span className="text-rhip-muted">Community · </span>
            {focus.community}
          </p>
          {focus.specialty_area && (
            <p className="text-rhip-body mb-2">
              <span className="text-rhip-muted">Specialty · </span>
              {focus.specialty_area}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {(focus.topics || []).slice(0, 8).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-rhip-cardBg text-rhip-body text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
            Relationships
          </h3>
          {focus.has_real_collaborations ? (
            <ul className="space-y-3">
              {(focus.collaborators || []).map((c) => (
                <li key={c.id}>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => focusPerson(c.id)}
                      className="text-rhip-dark font-medium truncate text-left hover:text-rhip-teal"
                    >
                      {c.name}
                    </button>
                    <span className="text-xs text-rhip-muted shrink-0 capitalize">{c.role}</span>
                  </div>
                  {(c.shared_publications || []).length > 0 && (
                    <ul className="mt-1.5 ml-0.5 space-y-1 border-l-2 border-rhip-lightTeal pl-2.5">
                      {(c.shared_publications || []).slice(0, 3).map((paper) => (
                        <li key={paper.pmid || paper.title}>
                          {paper.url ? (
                            <a
                              href={paper.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-rhip-teal hover:underline leading-snug block"
                            >
                              {paper.title}
                            </a>
                          ) : (
                            <span className="text-xs text-rhip-body leading-snug block">
                              {paper.title}
                            </span>
                          )}
                          {paper.pmid && (
                            <span className="text-[10px] text-rhip-muted">PMID {paper.pmid}</span>
                          )}
                        </li>
                      ))}
                      {(c.shared_count || 0) > 3 && (
                        <li className="text-[10px] text-rhip-muted">
                          +{c.shared_count - 3} more shared publication
                          {c.shared_count - 3 === 1 ? '' : 's'}
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-rhip-muted flex gap-2 items-start">
              <MapPinIcon className="w-4 h-4 mt-0.5 shrink-0 text-rhip-teal" />
              <span>
                {focus.empty_collaborations_message ||
                  "No recorded collaborations yet — here is the topical neighbourhood."}
              </span>
            </p>
          )}

          {(focus.nearby_expertise || []).length > 0 && (
            <div className="mt-3 pt-3 border-t border-rhip-border">
              <p className="text-xs text-rhip-muted mb-2">
                Nearby expertise <span className="italic">(similar topics, not collaborators)</span>
              </p>
              <ul className="space-y-1.5">
                {focus.nearby_expertise.slice(0, 6).map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => focusPerson(n.id)}
                      className="text-rhip-body truncate text-left hover:text-rhip-teal"
                    >
                      {n.name}
                    </button>
                    <span className="text-xs text-rhip-muted shrink-0">{n.community}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {(focus.projects || []).length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
              Projects
            </h3>
            <ul className="space-y-2">
              {focus.projects.map((p) => (
                <li key={p.id}>
                  {showPipelineLinks ? (
                    <Link
                      to="/pipeline"
                      className="text-rhip-teal hover:underline font-medium"
                    >
                      {p.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-rhip-dark">{p.title}</span>
                  )}
                  <p className="text-xs text-rhip-muted">TRL {p.trl} · {p.specialty_area}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {opportunityInsights.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
              Opportunities
            </h3>
            <ul className="space-y-2">
              {opportunityInsights.map((insight) => (
                <li
                  key={insight.id}
                  className="flex gap-2 rounded-xl bg-rhip-lightTeal/50 border border-rhip-teal/15 px-3 py-2.5"
                >
                  <LightBulbIcon className="w-4 h-4 text-rhip-teal shrink-0 mt-0.5" />
                  <span className="text-rhip-body">{insight.message}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="px-5 py-4 border-t border-rhip-border flex flex-wrap gap-2 mt-auto">
        <Link
          to={`/directory/${focus.profile_id}`}
          className="flex-1 min-w-[120px] text-center py-2.5 rounded-xl bg-rhip-teal text-white text-sm font-medium hover:bg-rhip-seafoam transition-colors"
        >
          View full profile
        </Link>
        {onStartBridge && (
          <button
            type="button"
            onClick={onStartBridge}
            className="px-4 py-2.5 rounded-xl border border-rhip-teal/40 text-sm font-medium text-rhip-teal hover:bg-rhip-lightTeal transition-colors"
          >
            Find bridge
          </button>
        )}
        {onExploreCommunity && (
          <button
            type="button"
            onClick={onExploreCommunity}
            className="px-4 py-2.5 rounded-xl border border-rhip-border text-sm font-medium text-rhip-body hover:bg-rhip-lightBg transition-colors"
          >
            Community
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl border border-rhip-border text-sm font-medium text-rhip-body hover:bg-rhip-lightBg transition-colors"
        >
          Landscape
        </button>
      </div>
    </aside>
  )
}
