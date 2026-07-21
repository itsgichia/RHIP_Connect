import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import PublicNavBar from '../components/layout/PublicNavBar'
import { firebaseSignup, resendVerificationEmail, useFirebaseAuth } from '../lib/authHelpers'
import api from '../hooks/useApi'
import { isBlockedEmail, BLOCKED_EMAIL_MESSAGE } from '../utils/blockedDomains'
import {
  CAREER_LEVEL_LABELS,
  CAREER_LEVELS,
  IDENTITY_FACET_LABELS,
  IDENTITY_FACETS,
} from '../utils/roles'

const SPECIALTY_AREAS = [
  'Mental Health & Neuroscience',
  'Personalised Medicine',
  'Rare Diseases',
  'Health Systems',
]

const FACET_OPTIONS = [
  IDENTITY_FACETS.CLINICIAN,
  IDENTITY_FACETS.RESEARCHER,
  IDENTITY_FACETS.PROFESSIONAL_TECHNICAL,
  IDENTITY_FACETS.POLICY,
]

export default function SignupPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'member', // member | industry
    identity_facets: [IDENTITY_FACETS.CLINICIAN],
    primary_lens: IDENTITY_FACETS.CLINICIAN,
    career_level: CAREER_LEVELS.MID,
    professional_title: '',
    institution_name: '',
    specialty_area: '',
  })
  const [emailError, setEmailError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  const isMember = form.accountType === 'member'
  const showSpecialty = isMember
  const showProfessionalTitle = form.identity_facets.includes(IDENTITY_FACETS.PROFESSIONAL_TECHNICAL)

  const toggleFacet = (facet) => {
    setForm((prev) => {
      const has = prev.identity_facets.includes(facet)
      let next = has
        ? prev.identity_facets.filter((f) => f !== facet)
        : [...prev.identity_facets, facet]
      if (next.length === 0) next = [facet]
      const primary_lens = next.includes(prev.primary_lens) ? prev.primary_lens : next[0]
      return { ...prev, identity_facets: next, primary_lens }
    })
  }

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
    if (isMember && form.identity_facets.length === 0) {
      toast.error('Select at least one identity')
      return
    }
    if (showProfessionalTitle && !form.professional_title.trim()) {
      toast.error('Add your professional title (e.g. biostatistician, lab tech)')
      return
    }
    setLoading(true)
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        institution_name: form.institution_name,
        specialty_area: showSpecialty ? form.specialty_area : null,
        role: isMember ? null : 'industry',
        identity_facets: isMember ? form.identity_facets : [],
        primary_lens: isMember ? form.primary_lens : null,
        career_level: isMember ? form.career_level : null,
        professional_title: showProfessionalTitle ? form.professional_title.trim() : null,
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
      toast.error(typeof message === 'string' ? message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    try {
      await resendVerificationEmail({ email: form.email, password: form.password })
      toast.success('Verification email sent. Check your inbox and spam folder.')
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        (err?.code === 'auth/too-many-requests'
          ? 'Too many attempts. Please wait a few minutes before trying again.'
          : err.message) ||
        'Could not resend verification email'
      toast.error(message)
    } finally {
      setResendLoading(false)
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
            <p className="text-sm text-rhip-muted mt-2">
              Check your spam folder if you don&apos;t see it within a few minutes.
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              className="mt-6 w-full py-3 border border-rhip-teal text-rhip-teal rounded-xl font-medium hover:bg-rhip-lightTeal transition-colors disabled:opacity-50"
            >
              {resendLoading ? 'Sending...' : 'Resend verification email'}
            </button>
            <Link to="/auth/login" className="inline-block mt-4 text-rhip-teal hover:underline">
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
          <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-2">Create Account</h1>
          <p className="text-sm text-rhip-muted mb-6">
            Tell us how you work, and we&apos;ll create a profile for you. 
          </p>
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
              <label className="block text-sm font-medium mb-2">I am joining as</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, accountType: 'member' })}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm border ${
                    isMember
                      ? 'border-rhip-teal bg-rhip-lightTeal text-rhip-teal'
                      : 'border-gray-200 text-rhip-muted'
                  }`}
                >
                  Precinct member
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, accountType: 'industry' })}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm border ${
                    !isMember
                      ? 'border-rhip-teal bg-rhip-lightTeal text-rhip-teal'
                      : 'border-gray-200 text-rhip-muted'
                  }`}
                >
                  Industry partner
                </button>
              </div>
            </div>

            {isMember && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Identities (select all that apply)</label>
                  <div className="space-y-2">
                    {FACET_OPTIONS.map((facet) => (
                      <label key={facet} className="flex items-center gap-2 text-sm text-rhip-body">
                        <input
                          type="checkbox"
                          checked={form.identity_facets.includes(facet)}
                          onChange={() => toggleFacet(facet)}
                          className="rounded border-gray-300 text-rhip-teal focus:ring-rhip-teal"
                        />
                        {IDENTITY_FACET_LABELS[facet]}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Primary focus (for your homepage view)</label>
                  <select
                    value={form.primary_lens}
                    onChange={(e) => setForm({ ...form, primary_lens: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                  >
                    {form.identity_facets.map((f) => (
                      <option key={f} value={f}>{IDENTITY_FACET_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Career level</label>
                  <select
                    value={form.career_level}
                    onChange={(e) => setForm({ ...form, career_level: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                  >
                    {Object.values(CAREER_LEVELS).map((level) => (
                      <option key={level} value={level}>{CAREER_LEVEL_LABELS[level]}</option>
                    ))}
                  </select>
                  {form.career_level === CAREER_LEVELS.STUDENT && (
                    <p className="text-xs text-rhip-muted mt-1">
                      HDR / postgraduate students use the researcher identity with this career level.
                    </p>
                  )}
                </div>
                {showProfessionalTitle && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Professional title</label>
                    <input
                      value={form.professional_title}
                      onChange={(e) => setForm({ ...form, professional_title: e.target.value })}
                      placeholder="e.g. Biostatistician, Lab technician, Registry manager"
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                    />
                  </div>
                )}
              </>
            )}

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
