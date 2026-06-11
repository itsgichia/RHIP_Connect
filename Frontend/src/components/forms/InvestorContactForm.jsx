import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../hooks/useApi'

export default function InvestorContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/forms/investor-contact', form)
      setSuccess(true)
      toast.success('Message sent!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-rhip-lightBg rounded-2xl p-8 text-center">
        <p className="text-rhip-teal font-medium text-lg">Message received.</p>
        <p className="text-rhip-muted mt-2">The RHIP team will be in touch.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-display text-xl font-semibold text-rhip-dark">Get in Touch</h3>
      {['name', 'email', 'phone'].map((field) => (
        <div key={field}>
          <label className="block text-sm font-medium mb-1 capitalize">{field}</label>
          <input
            type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
          />
        </div>
      ))}
      <div>
        <label className="block text-sm font-medium mb-1">Message</label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          required
          rows={5}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-rhip-teal text-white rounded-xl font-medium hover:bg-rhip-seafoam transition-colors disabled:opacity-50"
      >
        Send message
      </button>
    </form>
  )
}
