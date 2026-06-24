import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../hooks/useApi'

const ALL_SPECIALTIES = 'All specialties'

const SPECIALTY_AREAS = [
  'Mental Health & Neuroscience',
  'Personalised Medicine',
  'Rare Diseases',
  'Health Systems',
]

export default function ChallengeForm({ onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', specialty_area: ALL_SPECIALTIES })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.description.length < 50) {
      toast.error('Description must be at least 50 characters')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/challenges', form)
      toast.success('Challenge posted! AI matching in progress...')
      onCreated?.(data.id)
      setForm({ title: '', description: '', specialty_area: ALL_SPECIALTIES })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to post challenge')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
          minLength={50}
          rows={5}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
        <p className="text-xs text-rhip-muted mt-1">{form.description.length}/50 min characters</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Specialty filter (optional)</label>
        <select
          value={form.specialty_area}
          onChange={(e) => setForm({ ...form, specialty_area: e.target.value })}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        >
          <option value={ALL_SPECIALTIES}>All specialties</option>
          {SPECIALTY_AREAS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <p className="text-xs text-rhip-muted mt-1">
          Leave on &quot;All specialties&quot; to search the whole precinct, or narrow to one area.
        </p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-rhip-teal text-white rounded-xl font-medium hover:bg-rhip-seafoam transition-colors disabled:opacity-50"
      >
        {loading ? 'Posting...' : 'Post Challenge'}
      </button>
    </form>
  )
}
