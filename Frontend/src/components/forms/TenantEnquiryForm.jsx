import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../hooks/useApi'

export default function TenantEnquiryForm() {
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    company_type: 'biotech',
    desks_needed: 10,
    preferred_start: '',
    message: '',
  })
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/forms/tenant-enquiry', {
        ...form,
        desks_needed: Number(form.desks_needed),
        preferred_start: form.preferred_start || null,
      })
      setSuccess(true)
      toast.success('Enquiry submitted!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center">
        <p className="text-rhip-teal font-medium text-lg">Thank you.</p>
        <p className="text-rhip-muted mt-2">RHIP will be in touch within 2 business days.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
      <h3 className="font-display text-xl font-semibold text-rhip-dark">Enquire About Tenancy</h3>
      {['company_name', 'contact_name', 'email', 'phone'].map((field) => (
        <div key={field}>
          <label className="block text-sm font-medium mb-1 capitalize">
            {field.replace('_', ' ')}
          </label>
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
        <label className="block text-sm font-medium mb-1">Company type</label>
        <select
          value={form.company_type}
          onChange={(e) => setForm({ ...form, company_type: e.target.value })}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        >
          {['biotech', 'medtech', 'healthtech', 'pharma', 'digital health', 'research', 'other'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Number of desks needed</label>
        <input
          type="number"
          min="1"
          value={form.desks_needed}
          onChange={(e) => setForm({ ...form, desks_needed: e.target.value })}
          required
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Preferred start date</label>
        <input
          type="date"
          value={form.preferred_start}
          onChange={(e) => setForm({ ...form, preferred_start: e.target.value })}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Message</label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={4}
          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-rhip-teal text-white rounded-xl font-medium hover:bg-rhip-seafoam transition-colors disabled:opacity-50"
      >
        Submit enquiry
      </button>
    </form>
  )
}
