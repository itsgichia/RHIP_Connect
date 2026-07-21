import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MagnifyingGlassIcon, MapIcon } from '@heroicons/react/24/outline'
import api from '../hooks/useApi'
import ProfileListItem from '../components/ui/ProfileListItem'
import { SPECIALTY_AREAS } from '../utils/specialties'
import {
  CAREER_LEVEL_LABELS,
  CAREER_LEVELS,
  IDENTITY_FACET_LABELS,
  IDENTITY_FACETS,
} from '../utils/roles'

const PAGE_SIZE = 12

const FACET_FILTERS = [
  IDENTITY_FACETS.CLINICIAN,
  IDENTITY_FACETS.RESEARCHER,
  IDENTITY_FACETS.PROFESSIONAL_TECHNICAL,
  IDENTITY_FACETS.POLICY,
]

export default function DirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [profiles, setProfiles] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(searchParams.get('query') || '')
  const [suggested, setSuggested] = useState([])

  const query = searchParams.get('query') || ''
  const specialty = searchParams.get('specialty') || ''
  const institution = searchParams.get('institution') || ''
  const facetsParam = searchParams.get('facets') || ''
  const careerLevel = searchParams.get('career_level') || ''
  const selectedFacets = facetsParam ? facetsParam.split(',').filter(Boolean) : []
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('query', query)
      if (specialty) params.set('specialty', specialty)
      if (institution) params.set('institution', institution)
      if (facetsParam) params.set('facets', facetsParam)
      if (careerLevel) params.set('career_level', careerLevel)
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      const { data } = await api.get(`/directory/search?${params}`)
      setProfiles(data.profiles)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [query, specialty, institution, facetsParam, careerLevel, page])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  useEffect(() => {
    api
      .get('/directory/me/suggestions?limit=4')
      .then((res) => setSuggested(res.data.profiles || []))
      .catch(() => setSuggested([]))
  }, [])

  useEffect(() => {
    setSearchInput(query)
  }, [query])

  const updateParam = (key, value, resetPage = false) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (resetPage) next.delete('page')
    setSearchParams(next)
  }

  const toggleFacetFilter = (facet) => {
    const next = selectedFacets.includes(facet)
      ? selectedFacets.filter((f) => f !== facet)
      : [...selectedFacets, facet]
    updateParam('facets', next.join(','), true)
  }

  const goToPage = (nextPage) => {
    const clamped = Math.min(Math.max(1, nextPage), totalPages)
    updateParam('page', clamped === 1 ? '' : String(clamped))
  }

  const handleSearch = (e) => {
    e.preventDefault()
    updateParam('query', searchInput.trim(), true)
  }

  const hasFilters = query || specialty || institution || facetsParam || careerLevel || page > 1

  return (
    <div className="max-w-4xl">
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
        <div className="bg-rhip-dark px-6 md:px-10 py-8 md:py-10 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
            Find an Expert
          </h1>
          <p className="text-rhip-ice text-sm md:text-base max-w-xl mx-auto">
            Search by expertise, specialty, identity (e.g. clinician + researcher), or career level.
          </p>
          <Link
            to="/map"
            className="inline-flex items-center gap-2 mt-4 text-sm text-rhip-ice/90 hover:text-white transition-colors"
          >
            <MapIcon className="w-4 h-4" />
            Explore the Knowledge Map
          </Link>
        </div>

        <form onSubmit={handleSearch} className="px-6 md:px-10 py-6 border-b border-gray-100">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rhip-muted" />
            <input
              type="text"
              placeholder="Search by name, title, or expertise..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal text-rhip-body"
            />
          </div>
        </form>

        <div className="px-6 md:px-10 py-5 flex flex-wrap gap-3 items-center">
          <select
            value={specialty}
            onChange={(e) => updateParam('specialty', e.target.value, true)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal bg-white"
          >
            <option value="">All specialties</option>
            {SPECIALTY_AREAS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={careerLevel}
            onChange={(e) => updateParam('career_level', e.target.value, true)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal bg-white"
          >
            <option value="">All career levels</option>
            {Object.values(CAREER_LEVELS).map((level) => (
              <option key={level} value={level}>{CAREER_LEVEL_LABELS[level]}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Filter by institution"
            value={institution}
            onChange={(e) => updateParam('institution', e.target.value, true)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal flex-1 min-w-[180px]"
          />
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                setSearchParams(new URLSearchParams())
              }}
              className="text-sm text-rhip-teal hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="px-6 md:px-10 pb-5 flex flex-wrap gap-2">
          <span className="text-xs text-rhip-muted self-center mr-1">Identities (AND):</span>
          {FACET_FILTERS.map((facet) => {
            const active = selectedFacets.includes(facet)
            return (
              <button
                key={facet}
                type="button"
                onClick={() => toggleFacetFilter(facet)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? 'bg-rhip-dark text-white'
                    : 'bg-white text-rhip-body border border-gray-200 hover:border-rhip-teal/40'
                }`}
              >
                {IDENTITY_FACET_LABELS[facet]}
              </button>
            )
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => updateParam('specialty', '', true)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !specialty
              ? 'bg-rhip-dark text-white'
              : 'bg-white text-rhip-body border border-gray-200 hover:border-rhip-teal/40'
          }`}
        >
          All areas
        </button>
        {SPECIALTY_AREAS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => updateParam('specialty', specialty === s ? '' : s, true)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              specialty === s
                ? 'bg-rhip-dark text-white'
                : 'bg-white text-rhip-body border border-gray-200 hover:border-rhip-teal/40'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {suggested.length > 0 && !hasFilters && (
        <section className="mb-8">
          <h2 className="font-display text-lg font-semibold text-rhip-dark mb-3">
            Suggested from your institution
          </h2>
          <div className="space-y-3">
            {suggested.map((p) => (
              <ProfileListItem key={`sug-${p.id}`} profile={p} />
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <p className="text-rhip-muted">Loading...</p>
      ) : profiles.length === 0 ? (
        <p className="text-rhip-muted">No profiles match these filters.</p>
      ) : (
        <>
          <p className="text-sm text-rhip-muted mb-4">{total} result{total === 1 ? '' : 's'}</p>
          <div className="space-y-3">
            {profiles.map((p) => (
              <ProfileListItem key={p.id} profile={p} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-rhip-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
