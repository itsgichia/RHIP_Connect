import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../hooks/useApi'
import { formatAud } from '../../utils/formatters'

export default function ProjectInvestForm({ projectId, projectTitle, onSuccess }) {
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const parsed = Number(amount)
    if (!parsed || parsed <= 0) {
      toast.error('Enter a valid investment amount')
      return
    }
    setLoading(true)
    try {
      await api.post(`/investor/projects/${projectId}/invest`, {
        amount: parsed,
        message,
      })
      setSuccess(true)
      toast.success('Investment submitted!')
      onSuccess?.(parsed)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-rhip-lightBg rounded-xl p-6 text-center">
        <p className="text-rhip-teal font-medium">Expression of interest received</p>
        <p className="text-sm text-rhip-muted mt-2">
          RHIP will contact you about your {formatAud(Number(amount))} investment in{' '}
          <span className="font-medium text-rhip-dark">{projectTitle}</span>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h4 className="font-semibold text-rhip-dark mb-1">Express interest to invest</h4>
        <p className="text-sm text-rhip-muted">
          Submit an indicative amount. This is not a binding commitment — RHIP will follow up
          to discuss terms.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Investment amount (AUD)</label>
        <input
          type="number"
          min="1000"
          step="1000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 250000"
          required
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Message (optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Share your investment thesis or any questions…"
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-rhip-teal text-white rounded-xl font-medium hover:bg-rhip-seafoam transition-colors disabled:opacity-50"
      >
        {loading ? 'Submitting…' : 'Submit investment interest'}
      </button>
    </form>
  )
}
