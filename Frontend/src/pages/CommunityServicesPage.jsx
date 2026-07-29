import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import api from '../hooks/useApi'
import PublicNavBar from '../components/layout/PublicNavBar'
import CommunityNav from '../components/layout/CommunityNav'
import ServiceCard from '../components/ui/ServiceCard'

const DISTRICT_SLUG = 'seslhd-randwick'

export default function CommunityServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [services, setServices] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(searchParams.get('query') || '')

  const query = searchParams.get('query') || ''
  const specialty = searchParams.get('specialty') || ''

  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ district: DISTRICT_SLUG })
      if (query) params.set('query', query)
      if (specialty) params.set('specialty', specialty)
      const { data } = await api.get(`/community/services?${params}`)
      setServices(data.services)
      setSpecialties(data.specialties)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [query, specialty])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

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

      <div className="max-w-6xl mx-auto px-6 py-10">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
          <div className="bg-rhip-dark px-6 md:px-10 py-8 md:py-10 text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
              List of Services
            </h1>
            <p className="text-rhip-ice text-sm md:text-base max-w-xl mx-auto">
              Clinical departments and outpatient services available at Randwick campus facilities.
            </p>
          </div>

          <form onSubmit={handleSearch} className="px-6 md:px-10 py-6 border-b border-gray-100">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rhip-muted" />
              <input
                type="text"
                placeholder="Search services..."
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
              {specialties.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(query || specialty) && (
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

        <p className="text-sm text-rhip-muted mb-6">
          {loading ? 'Loading...' : `${total} ${total === 1 ? 'service' : 'services'} found`}
        </p>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-48 animate-pulse" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <p className="text-rhip-body font-medium mb-1">No services found</p>
            <p className="text-sm text-rhip-muted">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
