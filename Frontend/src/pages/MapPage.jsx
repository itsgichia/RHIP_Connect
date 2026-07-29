import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'
import api from '../hooks/useApi'
import KnowledgeMapGraph from '../components/map/KnowledgeMapGraph'
import MapFocusPanel from '../components/map/MapFocusPanel'
import MapCommunityPanel from '../components/map/MapCommunityPanel'
import MapPathPanel from '../components/map/MapPathPanel'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../utils/roles'

const ROLE_LENSES = [
  { value: '', label: 'All identities' },
  { value: 'role:clinician', label: 'Clinicians' },
  { value: 'role:researcher', label: 'Researchers' },
  { value: 'role:professional_technical', label: 'Professional / technical' },
  { value: 'role:policy', label: 'Policy' },
  { value: 'role:admin', label: 'Admin' },
]

export default function MapPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
  const [bridgeArmed, setBridgeArmed] = useState(false)

  const focus = searchParams.get('focus') || ''
  const challenge = searchParams.get('challenge') || ''
  const fromMatch = searchParams.get('from') === 'match'
  const q = searchParams.get('q') || ''
  const lens = searchParams.get('lens') || ''
  const community = searchParams.get('community') || ''
  const pathA = searchParams.get('pathA') || ''
  const pathB = searchParams.get('pathB') || ''
  const affinityParam = searchParams.get('affinity') === '1' || searchParams.get('affinity') === 'true'

  const bridgeActive = Boolean(pathA && pathB)
  const communityActive = Boolean(community) && !bridgeActive && !focus
  const focusActive = Boolean(focus) && !bridgeActive
  const showSidePanel = bridgeActive || communityActive || focusActive

  const showAffinity =
    affinityParam || Boolean(focus) || Boolean(q) || Boolean(community) || bridgeActive

  const bridgePickMode = bridgeArmed || (Boolean(pathA) && !pathB)

  const fetchMap = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (focus && !bridgeActive) params.set('focus', focus)
      if (challenge) params.set('challenge', challenge)
      if (q) params.set('q', q)
      if (lens) params.set('lens', lens)
      if (community && !bridgeActive && !focus) params.set('community', community)
      if (pathA) params.set('pathA', pathA)
      if (pathB) params.set('pathB', pathB)
      if (showAffinity) params.set('show_affinity', 'true')
      const { data: payload } = await api.get(`/map?${params}`)
      setData(payload)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
            : 'Could not load the Knowledge Map'
      )
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [focus, challenge, q, lens, showAffinity, community, pathA, pathB, bridgeActive])

  useEffect(() => {
    fetchMap()
  }, [fetchMap])

  useEffect(() => {
    setSearchInput(q)
  }, [q])

  useEffect(() => {
    if (pathA && pathB) setBridgeArmed(false)
  }, [pathA, pathB])

  const audienceHint = useMemo(() => {
    if (bridgeActive) {
      return 'Showing how two people connect across the ecosystem — recorded ties first, then topical similarity.'
    }
    if (communityActive) {
      return `Exploring the ${community} community — members, role mix, and bridges outward.`
    }
    if (fromMatch && focus) {
      return 'Explaining where this match sits in the ecosystem — not a new ranking.'
    }
    if (user?.role === ROLES.INDUSTRY || user?.role === ROLES.INVESTOR) {
      return 'Explore translation opportunities across research communities.'
    }
    if (user?.role === ROLES.RESEARCHER) {
      return 'Discover neighbouring expertise and how communities connect.'
    }
    return 'Understand how the healthcare innovation ecosystem fits together.'
  }, [fromMatch, focus, user?.role, bridgeActive, communityActive, community])

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === false) {
        next.delete(key)
      } else {
        next.set(key, String(value))
      }
    })
    setSearchParams(next)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setBridgeArmed(false)
    updateParams({
      q: searchInput.trim(),
      focus: null,
      from: null,
      challenge: null,
      community: null,
      pathA: null,
      pathB: null,
    })
  }

  const enterCommunity = (name) => {
    setBridgeArmed(false)
    updateParams({
      community: name,
      focus: null,
      from: null,
      challenge: null,
      pathA: null,
      pathB: null,
      q: null,
    })
  }

  const handleNodeClick = (node) => {
    if (bridgePickMode) {
      if (!pathA) {
        updateParams({ pathA: node.id, pathB: null, focus: null })
        setBridgeArmed(true)
        return
      }
      if (pathA && !pathB) {
        if (node.id === pathA) return
        updateParams({ pathB: node.id, focus: null, community: null })
        setBridgeArmed(false)
        return
      }
    }
    updateParams({
      focus: node.id,
      pathA: null,
      pathB: null,
      community: null,
    })
    setBridgeArmed(false)
  }

  const startBridgeFrom = (profileId) => {
    setBridgeArmed(true)
    updateParams({
      pathA: profileId,
      pathB: null,
      focus: null,
      community: null,
      from: null,
      challenge: null,
    })
  }

  const clearFocus = () => {
    updateParams({ focus: null, from: null, challenge: null })
  }

  const clearCommunity = () => {
    updateParams({ community: null })
  }

  const clearBridge = () => {
    setBridgeArmed(false)
    updateParams({ pathA: null, pathB: null })
  }

  const toggleAffinity = () => {
    if (focus || q || community || bridgeActive) return
    updateParams({ affinity: affinityParam ? null : '1' })
  }

  const toggleBridgeTool = () => {
    if (bridgeActive || bridgePickMode) {
      clearBridge()
      return
    }
    setBridgeArmed(true)
    updateParams({ pathA: null, pathB: null, focus: null, community: null })
  }

  const landscapeInsights = (data?.insights || []).filter((i) => i.type === 'opportunity')
  const pathNodeIds = data?.path_view?.hops?.map((h) => h.profile_id) || null
  const pathEdgeIds = data?.path_view?.edges?.map((e) => e.id) || null
  const graphEdges = useMemo(() => {
    const base = data?.edges || []
    const pathEdges = data?.path_view?.edges || []
    if (!pathEdges.length) return base
    const byId = new Map(base.map((e) => [e.id, e]))
    for (const e of pathEdges) {
      if (!byId.has(e.id)) byId.set(e.id, e)
    }
    return [...byId.values()]
  }, [data?.edges, data?.path_view?.edges])

  return (
    <div className="max-w-6xl">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-rhip-teal font-medium mb-1">
          Knowledge Map
        </p>
        <h1 className="font-display text-3xl font-bold text-rhip-dark mb-2">
          How the ecosystem fits together
        </h1>
        <p className="text-rhip-muted text-sm md:text-base max-w-2xl">{audienceHint}</p>
        <p className="text-xs text-rhip-muted mt-2">
          Click a community label to enter a region, or use Find a bridge to see how two people connect.
        </p>
      </header>

      <div className={`grid gap-6 ${showSidePanel ? 'lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start' : ''}`}>
        <div className="min-w-0 space-y-6">
          <div className="bg-white rounded-2xl border border-rhip-border shadow-sm overflow-hidden">
            <div className="px-4 md:px-6 py-4 flex flex-col lg:flex-row gap-3 lg:items-center border-b border-rhip-border">
              <form onSubmit={handleSearch} className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-rhip-muted" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search topics, people, specialties…"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                />
              </form>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-rhip-muted">
                  <AdjustmentsHorizontalIcon className="w-4 h-4" />
                  <select
                    value={lens}
                    onChange={(e) => updateParams({ lens: e.target.value || null })}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                  >
                    {ROLE_LENSES.map((opt) => (
                      <option key={opt.value || 'all'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={toggleAffinity}
                  disabled={Boolean(focus) || Boolean(q) || Boolean(community) || bridgeActive}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    showAffinity
                      ? 'bg-rhip-lightTeal border-rhip-teal/30 text-rhip-teal'
                      : 'bg-white border-gray-200 text-rhip-body hover:border-rhip-teal/40'
                  } disabled:opacity-70`}
                  title="Related expertise is similarity — not collaboration"
                >
                  Related expertise {showAffinity ? 'on' : 'off'}
                </button>

                <button
                  type="button"
                  onClick={toggleBridgeTool}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    bridgePickMode || bridgeActive
                      ? 'bg-rhip-dark text-white border-rhip-dark'
                      : 'bg-white border-gray-200 text-rhip-body hover:border-rhip-teal/40'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  {bridgeActive
                    ? 'Clear bridge'
                    : bridgePickMode
                      ? pathA
                        ? 'Pick person B'
                        : 'Pick person A'
                      : 'Find a bridge'}
                </button>

                {(q || lens || focus || affinityParam || community || pathA || pathB) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('')
                      setBridgeArmed(false)
                      setSearchParams(new URLSearchParams())
                    }}
                    className="text-sm text-rhip-teal hover:underline px-1"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {bridgePickMode && (
              <div className="px-4 md:px-6 py-2 text-xs text-rhip-teal bg-rhip-lightTeal/40 border-b border-rhip-teal/15">
                {pathA
                  ? 'Bridge started — click a second person on the map.'
                  : 'Bridge mode — click the first person on the map.'}
              </div>
            )}

            <div className="px-4 md:px-6 py-3 flex flex-wrap gap-4 text-xs text-rhip-muted border-b border-rhip-border bg-rhip-lightBg/50">
              {(data?.legend?.edges || []).map((item) => (
                <span
                  key={item.type}
                  className="inline-flex items-center gap-1.5"
                  title={item.description || undefined}
                >
                  <span
                    className={
                      item.type === 'real'
                        ? 'w-6 border-t-2 border-rhip-teal'
                        : 'w-6 border-t border-dashed border-slate-400'
                    }
                  />
                  {item.label || (item.type === 'real' ? 'Recorded collaboration' : 'Related expertise')}
                </span>
              ))}
              {!(data?.legend?.edges || []).length && (
                <>
                  <span
                    className="inline-flex items-center gap-1.5"
                    title="PubMed co-authorship (shared publications)"
                  >
                    <span className="w-6 border-t-2 border-rhip-teal" />
                    Recorded collaboration
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-6 border-t border-dashed border-slate-400" />
                    Related expertise
                  </span>
                </>
              )}
              {(data?.legend?.roles || []).map((item) => (
                <span key={item.role} className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>

            {loading ? (
              <div className="h-80 animate-pulse bg-rhip-lightBg" />
            ) : error ? (
              <div className="p-10 text-center text-sm text-rhip-muted">{error}</div>
            ) : (
              <KnowledgeMapGraph
                nodes={data?.nodes || []}
                edges={graphEdges}
                focusId={focusActive ? focus : null}
                communityName={communityActive ? community : null}
                pathNodeIds={bridgeActive ? pathNodeIds : null}
                pathEdgeIds={bridgeActive ? pathEdgeIds : null}
                bridgePickMode={bridgePickMode}
                showAffinity={data?.show_affinity ?? showAffinity}
                communities={data?.communities || []}
                onNodeClick={handleNodeClick}
                onCommunityClick={enterCommunity}
              />
            )}
          </div>

          {!showSidePanel && landscapeInsights.length > 0 && (
            <section className="bg-white rounded-2xl border border-rhip-border p-5">
              <h2 className="font-display text-lg font-semibold text-rhip-dark mb-1">
                Opportunities across the map
              </h2>
              <p className="text-sm text-rhip-muted mb-4">
                Constructive signals based on who sits near each topic community,  not recommendations.
              </p>
              <ul className="space-y-2">
                {landscapeInsights.slice(0, 4).map((insight) => (
                  <li
                    key={insight.id}
                    className="text-sm text-rhip-body rounded-xl bg-rhip-lightTeal/40 border border-rhip-teal/10 px-4 py-3"
                  >
                    {insight.message}
                    {insight.target_community && (
                      <button
                        type="button"
                        className="block mt-1 text-xs text-rhip-teal hover:underline"
                        onClick={() => enterCommunity(insight.target_community)}
                      >
                        Explore {insight.target_community}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!showSidePanel && (
            <section className="text-sm text-rhip-muted">
              <p>
                Geography is organised by research topics and expertise. Roles are an overlay.
                Solid lines are recorded relationships; dashed lines are topical similarity.
              </p>
              {data?.communities?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {data.communities.slice(0, 12).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => enterCommunity(c)}
                      className="px-3 py-1 rounded-full bg-white border border-gray-200 text-xs text-rhip-body hover:border-rhip-teal/40 transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {bridgeActive && data?.path_view && (
          <MapPathPanel
            pathView={data.path_view}
            onClose={clearBridge}
            onClear={clearBridge}
            onFocusPerson={(profileId) =>
              updateParams({ focus: profileId, pathA: null, pathB: null, community: null })
            }
          />
        )}

        {communityActive && data?.community_view && (
          <MapCommunityPanel
            communityView={data.community_view}
            onClose={clearCommunity}
            onFocusPerson={(profileId) =>
              updateParams({ focus: profileId, community: null, pathA: null, pathB: null })
            }
            onStartBridge={startBridgeFrom}
          />
        )}

        {focusActive && data?.focus && (
          <MapFocusPanel
            focus={data.focus}
            insights={data.insights || []}
            challengeId={challenge || null}
            onClose={clearFocus}
            onFocusPerson={(profileId) =>
              updateParams({ focus: profileId, from: null, challenge: null })
            }
            onStartBridge={() => startBridgeFrom(data.focus.profile_id)}
            onExploreCommunity={
              data.focus.community ? () => enterCommunity(data.focus.community) : undefined
            }
          />
        )}
      </div>
    </div>
  )
}
