import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Dialog } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import api from '../hooks/useApi'
import ProfileCard from '../components/ui/ProfileCard'

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
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)

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

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  const openProfile = async (profile) => {
    setSelected(profile)
    const { data } = await api.get(`/directory/${profile.id}`)
    setDetail(data)
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-6">Expertise Directory</h1>

      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search by name, title, or expertise..."
          value={query}
          onChange={(e) => updateParam('query', e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
        <select
          value={specialty}
          onChange={(e) => updateParam('specialty', e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        >
          <option value="">All specialties</option>
          {SPECIALTY_AREAS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Institution"
          value={institution}
          onChange={(e) => updateParam('institution', e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
      </div>

      <p className="text-sm text-rhip-muted mb-4">{total} profiles found</p>

      {loading ? (
        <p className="text-rhip-muted">Loading...</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((p) => (
            <ProfileCard key={p.id} profile={p} onClick={openProfile} />
          ))}
        </div>
      )}

      <Dialog open={!!selected} onClose={() => { setSelected(null); setDetail(null) }} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-2xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <Dialog.Title className="font-display text-xl font-semibold text-rhip-dark">
                {detail?.name}
              </Dialog.Title>
              <button onClick={() => { setSelected(null); setDetail(null) }}>
                <XMarkIcon className="w-6 h-6 text-rhip-muted" />
              </button>
            </div>
            {detail && (
              <>
                <p className="text-rhip-muted mb-1">{detail.title}</p>
                {detail.institution_name && (
                  <p className="text-sm text-rhip-muted mb-4">{detail.institution_name}</p>
                )}
                <span className="inline-block px-2 py-1 bg-rhip-lightTeal text-rhip-teal text-xs rounded-full mb-4">
                  {detail.specialty_area}
                </span>
                <p className="text-rhip-body leading-relaxed mb-4">{detail.bio}</p>
                <div className="flex flex-wrap gap-1 mb-4">
                  {(detail.expertise_tags || []).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-rhip-cardBg text-rhip-body text-xs rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex gap-4 text-sm text-rhip-muted">
                  <span>{detail.publications} publications</span>
                  <span>{detail.active_projects} active projects</span>
                </div>
              </>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  )
}
