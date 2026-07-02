import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../hooks/useApi'

const PURPOSES = [
  'Policy briefing',
  'Funding review',
  'Parliamentary question',
  'Precinct board paper',
  'Other',
]

const FORMATS = [
  'Written brief',
  'Data export',
  'Meeting / presentation',
  'Phone call',
]

export default function GovernmentBriefingForm() {
  const [form, setForm] = useState({
    organisation: '',
    contact_name: '',
    email: '',
    phone: '',
    purpose: PURPOSES[0],
    topics: '',
    preferred_format: FORMATS[0],
    message: '',
  })
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/forms/government-briefing', form)
      setSuccess(true)
      toast.success('Briefing request submitted')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-rhip-lightBg rounded-2xl p-8 text-center">
        <p className="text-rhip-teal font-medium text-lg">Request received</p>
        <p className="text-rhip-muted mt-2">
          The RHIP team will be in touch within 5 business days.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-display text-xl font-semibold text-rhip-dark">
        Request a briefing
      </h3>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Organisation</label>
          <input
            type="text"
            value={form.organisation}
            onChange={(e) => setForm({ ...form, organisation: e.target.value })}
            placeholder="e.g. NSW Health, SESLHD"
            required
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contact name</label>
          <input
            type="text"
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Purpose</label>
          <select
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
          >
            {PURPOSES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Preferred format</label>
          <select
            value={form.preferred_format}
            onChange={(e) => setForm({ ...form, preferred_format: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Topics of interest</label>
        <input
          type="text"
          value={form.topics}
          onChange={(e) => setForm({ ...form, topics: e.target.value })}
          placeholder="e.g. Clinical trials, workforce capacity, research translation"
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Additional details</label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={4}
          placeholder="Deadline, audience, specific metrics needed"
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-rhip-teal text-white rounded-xl font-medium hover:bg-rhip-seafoam transition-colors disabled:opacity-50"
      >
        {loading ? 'Submitting…' : 'Submit briefing request'}
      </button>
    </form>
  )
}
