import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import api from '../hooks/useApi'
import PublicNavBar from '../components/layout/PublicNavBar'
import CommunityNav from '../components/layout/CommunityNav'
import SpecialistListItem from '../components/ui/SpecialistListItem'

const DISTRICT_SLUG = 'seslhd-randwick'

export default function CommunitySpecialistsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [specialists, setSpecialists] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(searchParams.get('query') || '')

  const query = searchParams.get('query') || ''
  const specialty = searchParams.get('specialty') || ''
  const service = searchParams.get('service') || ''

  const fetchSpecialists = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ district: DISTRICT_SLUG })
      if (query) params.set('query', query)
      if (specialty) params.set('specialty', specialty)
      if (service) params.set('service', service)
      const { data } = await api.get(`/community/specialists?${params}`)
      setSpecialists(data.specialists)
      setSpecialties(data.specialties)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [query, specialty, service])

  useEffect(() => {
    fetchSpecialists()
  }, [fetchSpecialists])

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
    <div className="min-h-screen bg-rhip-lightBg">
      <PublicNavBar />
      <CommunityNav />

      <div className="max-w-4xl mx-auto px-6 py-10">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
          <div className="bg-rhip-dark px-6 md:px-10 py-8 md:py-10 text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
              Our Specialists
            </h1>
            <p className="text-rhip-ice text-sm md:text-base max-w-xl mx-auto">
              Find specialists practising at Randwick campus facilities. Search by name or filter
              by specialty.
            </p>
          </div>

          <form onSubmit={handleSearch} className="px-6 md:px-10 py-6 border-b border-gray-100">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rhip-muted" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal text-rhip-body"
                />
              </div>
              <select
                value={specialty}
                onChange={(e) => updateParam('specialty', e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal bg-white"
              >
                <option value="">Select specialty...</option>
                {specialties.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </form>

          {(query || specialty) && (
            <div className="px-6 md:px-10 py-4 border-b border-gray-100">
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
            </div>
          )}
        </section>

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
            All specialties
          </button>
          {specialties.slice(0, 8).map((s) => (
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
          {loading ? 'Searching...' : `${total} ${total === 1 ? 'specialist' : 'specialists'} found`}
        </p>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl h-36 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : specialists.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <p className="text-rhip-body font-medium mb-1">No specialists found</p>
            <p className="text-sm text-rhip-muted">Try adjusting your search or specialty filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {specialists.map((s) => (
              <SpecialistListItem key={s.id} specialist={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
