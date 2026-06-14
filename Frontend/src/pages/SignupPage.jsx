import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import PublicNavBar from '../components/layout/PublicNavBar'
import { firebaseSignup, useFirebaseAuth } from '../lib/authHelpers'
import api from '../hooks/useApi'
import { isBlockedEmail, BLOCKED_EMAIL_MESSAGE } from '../utils/blockedDomains'

const SPECIALTY_AREAS = [
  'Mental Health & Neuroscience',
  'Personalised Medicine',
  'Rare Diseases',
  'Health Systems',
]

export default function SignupPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'clinician',
    institution_name: '',
    specialty_area: '',
  })
  const [emailError, setEmailError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const showSpecialty = form.role === 'clinician' || form.role === 'researcher'

  const handleEmailBlur = () => {
    if (form.email && isBlockedEmail(form.email)) {
      setEmailError(BLOCKED_EMAIL_MESSAGE)
    } else {
      setEmailError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (isBlockedEmail(form.email)) {
      setEmailError(BLOCKED_EMAIL_MESSAGE)
      return
    }
    setLoading(true)
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        institution_name: form.institution_name,
        specialty_area: showSpecialty ? form.specialty_area : null,
      }
      if (useFirebaseAuth()) {
        await firebaseSignup(payload)
      } else {
        await api.post('/auth/signup', payload)
      }
      setSuccess(true)
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        err.message ||
        'Signup failed'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-rhip-lightBg">
        <PublicNavBar hideLogin />
        <div className="flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-rhip-lightTeal rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✉️</span>
            </div>
            <h2 className="font-display text-xl font-semibold text-rhip-dark mb-2">Check your inbox</h2>
            <p className="text-rhip-muted">
              We&apos;ve sent a verification email to <strong>{form.email}</strong>.
            </p>
            <Link to="/auth/login" className="inline-block mt-6 text-rhip-teal hover:underline">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-rhip-lightBg">
      <PublicNavBar hideLogin />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
          <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-6">Create Account</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Work email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onBlur={handleEmailBlur}
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
              />
              {emailError && <p className="text-rhip-coral text-xs mt-1">{emailError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
              >
                <option value="clinician">Clinician</option>
                <option value="researcher">Researcher</option>
                <option value="industry">Industry Partner</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Institution name</label>
              <input
                value={form.institution_name}
                onChange={(e) => setForm({ ...form, institution_name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
              />
            </div>
            {showSpecialty && (
              <div>
                <label className="block text-sm font-medium mb-1">Specialty area</label>
                <select
                  value={form.specialty_area}
                  onChange={(e) => setForm({ ...form, specialty_area: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                >
                  <option value="">Select specialty</option>
                  {SPECIALTY_AREAS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-rhip-teal text-white rounded-xl font-medium hover:bg-rhip-seafoam transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-rhip-muted">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-rhip-teal hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
