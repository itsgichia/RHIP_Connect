import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import api from '../../hooks/useApi'
import RoleBadge from '../ui/RoleBadge'
import { isInvestor, ROLE_LABELS } from '../../utils/roles'

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'organisation', label: 'Organisation' },
]

function activationStepsFor(role) {
  if (isInvestor(role)) {
    return [
      {
        id: 'pipeline',
        title: 'Explore the investable pipeline',
        description:
          'Review ARC- and MRFF-backed projects ranked by indicative outlook score.',
        to: '/investor',
        cta: 'Open investor portal',
      },
      {
        id: 'hth',
        title: 'Review Health Translation Hub opportunities',
        description: 'See occupancy, co-location floors, and partnership context for HTH.',
        to: '/investor',
        cta: 'View HTH overview',
      },
      {
        id: 'contact',
        title: 'Contact the RHIP partnership team',
        description: 'Introduce your fund and tell us what opportunities you want to see.',
        to: '/investor',
        cta: 'Go to contact form',
      },
    ]
  }
  return [
    {
      id: 'pipeline',
      title: 'Browse the innovation pipeline',
      description: 'Discover commercial-stage projects and partnership pathways across the precinct.',
      to: '/pipeline',
      cta: 'Open pipeline',
    },
    {
      id: 'map',
      title: 'Explore the knowledge map',
      description: 'Find researchers, clinicians, and collaboration bridges relevant to your focus.',
      to: '/map',
      cta: 'Open map',
    },
    {
      id: 'directory',
      title: 'Browse the expertise directory',
      description: 'Identify precinct specialists and capability areas for co-development.',
      to: '/directory',
      cta: 'Open directory',
    },
  ]
}

function loadCompleted(userId) {
  try {
    const raw = localStorage.getItem(`rhip-activation-${userId}`)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCompleted(userId, map) {
  localStorage.setItem(`rhip-activation-${userId}`, JSON.stringify(map))
}

function StatusBadge({ done, labelDone, labelPending }) {
  return done ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800">
      {labelDone}
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-rhip-muted">
      {labelPending}
    </span>
  )
}

export default function PartnerAccountView({ profile, user, onProfileUpdate }) {
  const [tab, setTab] = useState('details')
  const [completed, setCompleted] = useState(() => loadCompleted(user?.id))
  const [saving, setSaving] = useState(false)
  const [orgForm, setOrgForm] = useState({
    title: profile.title || '',
    bio: profile.bio || '',
  })

  useEffect(() => {
    setOrgForm({
      title: profile.title || '',
      bio: profile.bio || '',
    })
  }, [profile.title, profile.bio])

  const steps = useMemo(() => activationStepsFor(user?.role), [user?.role])
  const pendingCount = steps.filter((s) => !completed[s.id]).length
  const activationReady = pendingCount === 0

  const markStep = (id) => {
    setCompleted((prev) => {
      const next = { ...prev, [id]: true }
      if (user?.id) saveCompleted(user.id, next)
      return next
    })
  }

  const handleSaveOrg = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.patch('/directory/me', {
        title: orgForm.title.trim() || profile.title,
        bio: orgForm.bio,
      })
      onProfileUpdate?.(data)
      toast.success('Organisation details updated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save details')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-rhip-dark">Account</h1>
          <p className="text-sm text-rhip-muted mt-1">
            Manage your {ROLE_LABELS[user?.role] || 'partner'} account and onboarding steps.
          </p>
        </div>
        {!activationReady && (
          <Link
            to={steps.find((s) => !completed[s.id])?.to || '/dashboard'}
            onClick={() => {
              const next = steps.find((s) => !completed[s.id])
              if (next) markStep(next.id)
            }}
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-rhip-coral text-white text-sm font-semibold hover:opacity-95"
          >
            Complete activation steps
          </Link>
        )}
      </div>

      <div className="flex gap-1 border-b border-rhip-border mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-rhip-teal text-rhip-teal'
                : 'border-transparent text-rhip-muted hover:text-rhip-dark'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl border border-rhip-border p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold text-rhip-dark mb-1">Details</h2>
            <p className="text-sm text-rhip-muted mb-6">
              Your account information is shown below.
            </p>

            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-1">
                  Name
                </p>
                <p className="text-rhip-dark font-medium">{profile.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RoleBadge role={user?.role} />
                  <StatusBadge
                    done={!!user?.email}
                    labelDone="Verified account"
                    labelPending="Unverified"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-1">
                  Email
                </p>
                <p className="text-rhip-dark">{user?.email || '—'}</p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-1">
                  Organisation
                </p>
                <p className="text-rhip-dark">{profile.institution_name || 'Not set'}</p>
                <p className="text-sm text-rhip-muted mt-0.5">{profile.title}</p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-2">
                  Security
                </p>
                <Link
                  to="/auth/forgot-password"
                  className="text-sm text-rhip-teal hover:underline"
                >
                  Change account password
                </Link>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-rhip-border p-6 shadow-sm">
            <div className="flex items-start gap-2 mb-1">
              <h2 className="font-display text-xl font-semibold text-rhip-dark">Activation</h2>
              {!activationReady && (
                <ExclamationTriangleIcon className="w-5 h-5 text-rhip-amber shrink-0 mt-1" />
              )}
            </div>
            <p className="text-sm text-rhip-muted mb-5">
              {isInvestor(user?.role)
                ? 'Complete these steps to be ready to engage with investable opportunities.'
                : 'Complete these steps to get the most from RHIP Connect as an industry partner.'}
            </p>

            <ul className="space-y-3">
              {steps.map((step) => {
                const done = !!completed[step.id]
                return (
                  <li
                    key={step.id}
                    className="flex gap-3 rounded-xl border border-rhip-border bg-rhip-lightBg/60 p-4"
                  >
                    <div className="shrink-0 mt-0.5">
                      {done ? (
                        <CheckCircleIcon className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <QuestionMarkCircleIcon className="w-6 h-6 text-rhip-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-rhip-dark">{step.title}</p>
                      <p className="text-sm text-rhip-muted mt-1 leading-relaxed">
                        {step.description}
                      </p>
                      {!done ? (
                        <Link
                          to={step.to}
                          onClick={() => markStep(step.id)}
                          className="inline-block mt-2 text-sm text-rhip-teal hover:underline"
                        >
                          {step.cta} →
                        </Link>
                      ) : (
                        <p className="mt-2 text-xs font-medium text-emerald-700">Completed</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      )}

      {tab === 'organisation' && (
        <section className="bg-white rounded-2xl border border-rhip-border p-6 shadow-sm max-w-2xl">
          <h2 className="font-display text-xl font-semibold text-rhip-dark mb-1">Organisation</h2>
          <p className="text-sm text-rhip-muted mb-6">
            How you appear when RHIP teams review partnership enquiries.
          </p>
          <form onSubmit={handleSaveOrg} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-rhip-dark mb-1">
                Role / title
              </label>
              <input
                type="text"
                value={orgForm.title}
                onChange={(e) => setOrgForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border border-rhip-border px-3 py-2 text-sm text-rhip-dark focus:outline-none focus:ring-2 focus:ring-rhip-teal/40"
                placeholder="e.g. Investment Director"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-rhip-dark mb-1">
                About your organisation
              </label>
              <textarea
                value={orgForm.bio}
                onChange={(e) => setOrgForm((f) => ({ ...f, bio: e.target.value }))}
                rows={5}
                className="w-full rounded-xl border border-rhip-border px-3 py-2 text-sm text-rhip-dark focus:outline-none focus:ring-2 focus:ring-rhip-teal/40"
                placeholder="Investment thesis, sector focus, or partnership interests…"
              />
            </div>
            <p className="text-xs text-rhip-muted">
              Organisation name is set from your signup institution
              {profile.institution_name ? ` (${profile.institution_name})` : ''}.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-rhip-teal text-white text-sm font-medium hover:bg-rhip-teal-hover disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
