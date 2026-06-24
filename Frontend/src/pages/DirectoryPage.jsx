import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import api from '../hooks/useApi'
import ProfileListItem from '../components/ui/ProfileListItem'

const SPECIALTY_AREAS = [
  'Mental Health & Neuroscience',
  'Personalised Medicine',
  'Rare Diseases',
  'Health Systems',
]

export default function DirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [profiles, setProfiles] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(searchParams.get('query') || '')

  const query = searchParams.get('query') || ''
  const specialty = searchParams.get('specialty') || ''
  const institution = searchParams.get('institution') || ''

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('query', query)
      if (specialty) params.set('specialty', specialty)
      if (institution) params.set('institution', institution)
      const { data } = await api.get(`/directory/search?${params}`)
      setProfiles(data.profiles)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [query, specialty, institution])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  useEffect(() => {
    setSearchInput(query)
  }, [query])

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    updateParam('query', searchInput.trim())
  }

  return (
    <div className="max-w-4xl">
      {/* Hero / search header */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
        <div className="bg-rhip-dark px-6 md:px-10 py-8 md:py-10 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
            Find an Expert
          </h1>
          <p className="text-rhip-ice text-sm md:text-base max-w-xl mx-auto">
            Search the RHIP research community by name, expertise, specialty, or institution.
          </p>
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
            onChange={(e) => updateParam('specialty', e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal bg-white"
          >
            <option value="">All specialties</option>
            {SPECIALTY_AREAS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Filter by institution"
            value={institution}
            onChange={(e) => updateParam('institution', e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal flex-1 min-w-[180px]"
          />
          {(query || specialty || institution) && (
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
      </section>

      {/* Specialty quick filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={() => updateParam('specialty', '')}
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
            onClick={() => updateParam('specialty', specialty === s ? '' : s)}
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

      <p className="text-sm text-rhip-muted mb-4">
        {loading ? 'Searching...' : `${total} ${total === 1 ? 'profile' : 'profiles'} found`}
      </p>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl h-36 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-rhip-body font-medium mb-1">No profiles found</p>
          <p className="text-sm text-rhip-muted">
            Try adjusting your search terms or clearing the filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <ProfileListItem key={p.id} profile={p} />
          ))}
        </div>
      )}
    </div>
  )
}
