import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import PublicNavBar from '../components/layout/PublicNavBar'
import { safeRedirectPath } from '../utils/navigation'
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

function needsIdentityDetail(detail) {
  if (!detail) return false
  if (typeof detail === 'object' && detail.code === 'needs_identity') return true
  return false
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [step, setStep] = useState('email') // email | identity
  const [identity, setIdentity] = useState({
    name: '',
    accountType: 'member',
    identity_facets: [IDENTITY_FACETS.CLINICIAN],
    primary_lens: IDENTITY_FACETS.CLINICIAN,
    career_level: CAREER_LEVELS.MID,
    professional_title: '',
    specialty_area: '',
  })
  const { login, institutionalLogin, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = safeRedirectPath(searchParams.get('redirect'))

  const isMember = identity.accountType === 'member'
  const showProfessionalTitle = identity.identity_facets.includes(
    IDENTITY_FACETS.PROFESSIONAL_TECHNICAL
  )

  const toggleFacet = (facet) => {
    setIdentity((prev) => {
      const has = prev.identity_facets.includes(facet)
      let next = has
        ? prev.identity_facets.filter((f) => f !== facet)
        : [...prev.identity_facets, facet]
      if (next.length === 0) next = [facet]
      const primary_lens = next.includes(prev.primary_lens) ? prev.primary_lens : next[0]
      return { ...prev, identity_facets: next, primary_lens }
    })
  }

  const handleInstitutionalContinue = async (e) => {
    e.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (isBlockedEmail(normalized)) {
      toast.error(BLOCKED_EMAIL_MESSAGE)
      return
    }
    try {
      await institutionalLogin({ email: normalized })
      toast.success('Welcome back!')
      navigate(redirectTo)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (needsIdentityDetail(detail)) {
        setStep('identity')
        return
      }
      toast.error(
        typeof detail === 'string'
          ? detail
          : detail?.message || err.message || 'Institutional login failed'
      )
    }
  }

  const handleIdentitySubmit = async (e) => {
    e.preventDefault()
    if (isMember && identity.identity_facets.length === 0) {
      toast.error('Select at least one identity')
      return
    }
    if (showProfessionalTitle && !identity.professional_title.trim()) {
      toast.error('Add your professional title')
      return
    }
    if (isMember && !identity.specialty_area) {
      toast.error('Select a specialty area')
      return
    }
    try {
      await institutionalLogin({
        email: email.trim().toLowerCase(),
        name: identity.name.trim(),
        role: isMember ? null : 'industry',
        identity_facets: isMember ? identity.identity_facets : [],
        primary_lens: isMember ? identity.primary_lens : null,
        career_level: isMember ? identity.career_level : null,
        professional_title: showProfessionalTitle
          ? identity.professional_title.trim()
          : null,
        specialty_area: isMember ? identity.specialty_area : null,
      })
      toast.success('Welcome to RHIP Connect!')
      navigate(redirectTo)
    } catch (err) {
      const detail = err.response?.data?.detail
      toast.error(
        typeof detail === 'string'
          ? detail
          : detail?.message || err.message || 'Could not create account'
      )
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate(redirectTo)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 401) {
        toast.error(
          detail ||
            'Invalid email or password. Seeded demo accounts use password DemoPass1! (check README).'
        )
      } else {
        toast.error(detail || err.message || 'Login failed')
      }
    }
  }

  return (
    <div className="min-h-screen bg-rhip-lightBg">
      <PublicNavBar hideLogin />
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
          <h1 className="font-display text-2xl font-semibold text-rhip-dark mb-2">Log In</h1>
          <p className="text-rhip-muted text-sm mb-6">
            Access the RHIP Connect platform with your institutional email
            <span className="block mt-1 text-xs">
              Demo institutional sign-in.
            </span>
          </p>

          {step === 'email' && (
            <>
              <form onSubmit={handleInstitutionalContinue} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-rhip-body mb-1">
                    Institutional email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@unsw.edu.au"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-rhip-teal text-white rounded-xl font-medium hover:bg-rhip-seafoam transition-colors disabled:opacity-50"
                >
                  {loading ? 'Continuing...' : 'Continue with institutional email'}
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-rhip-muted">or</span>
                </div>
              </div>

              {!showPasswordForm ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(true)}
                  className="w-full py-3 border border-gray-200 text-rhip-body rounded-xl font-medium hover:bg-rhip-lightBg transition-colors text-sm"
                >
                  Log in with password
                </button>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-rhip-body mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-rhip-body mb-1">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-rhip-teal text-white rounded-xl font-medium hover:bg-rhip-seafoam transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Logging in...' : 'Log In'}
                  </button>
                </form>
              )}
            </>
          )}

          {step === 'identity' && (
            <form onSubmit={handleIdentitySubmit} className="space-y-4">
              <p className="text-sm text-rhip-body">
                First time with <strong>{email}</strong>? Tell us how you work so we can set up
                your profile.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">Full name</label>
                <input
                  value={identity.name}
                  onChange={(e) => setIdentity({ ...identity, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">I am joining as</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIdentity({ ...identity, accountType: 'member' })}
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
                    onClick={() => setIdentity({ ...identity, accountType: 'industry' })}
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
                    <label className="block text-sm font-medium mb-2">
                      Identities (select all that apply)
                    </label>
                    <div className="space-y-2">
                      {FACET_OPTIONS.map((facet) => (
                        <label key={facet} className="flex items-center gap-2 text-sm text-rhip-body">
                          <input
                            type="checkbox"
                            checked={identity.identity_facets.includes(facet)}
                            onChange={() => toggleFacet(facet)}
                            className="rounded border-gray-300 text-rhip-teal focus:ring-rhip-teal"
                          />
                          {IDENTITY_FACET_LABELS[facet]}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Primary focus (for your homepage view)
                    </label>
                    <select
                      value={identity.primary_lens}
                      onChange={(e) =>
                        setIdentity({ ...identity, primary_lens: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                    >
                      {identity.identity_facets.map((f) => (
                        <option key={f} value={f}>
                          {IDENTITY_FACET_LABELS[f]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Career level</label>
                    <select
                      value={identity.career_level}
                      onChange={(e) =>
                        setIdentity({ ...identity, career_level: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                    >
                      {Object.values(CAREER_LEVELS).map((level) => (
                        <option key={level} value={level}>
                          {CAREER_LEVEL_LABELS[level]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {showProfessionalTitle && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Professional title</label>
                      <input
                        value={identity.professional_title}
                        onChange={(e) =>
                          setIdentity({ ...identity, professional_title: e.target.value })
                        }
                        placeholder="e.g. Biostatistician, Lab technician"
                        required
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1">Specialty area</label>
                    <select
                      value={identity.specialty_area}
                      onChange={(e) =>
                        setIdentity({ ...identity, specialty_area: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rhip-teal"
                    >
                      <option value="">Select specialty</option>
                      {SPECIALTY_AREAS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-rhip-teal text-white rounded-xl font-medium hover:bg-rhip-seafoam transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full text-sm text-rhip-muted hover:text-rhip-teal"
              >
                Use a different email
              </button>
            </form>
          )}

          <div className="mt-4 text-center text-sm text-rhip-muted space-y-2">
            {showPasswordForm && step === 'email' && (
              <p>
                <Link to="/auth/forgot-password" className="text-rhip-teal hover:underline">
                  Forgot password?
                </Link>
              </p>
            )}
            <p>
              Don&apos;t have an account?{' '}
              <Link to="/auth/signup" className="text-rhip-teal hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
