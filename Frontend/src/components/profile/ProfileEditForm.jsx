import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../hooks/useApi'
import { SPECIALTY_AREAS } from '../../utils/specialties'
import {
  CAREER_LEVEL_LABELS,
  CAREER_LEVELS,
  IDENTITY_FACET_LABELS,
  IDENTITY_FACETS,
} from '../../utils/roles'

const FACET_OPTIONS = [
  IDENTITY_FACETS.CLINICIAN,
  IDENTITY_FACETS.RESEARCHER,
  IDENTITY_FACETS.PROFESSIONAL_TECHNICAL,
  IDENTITY_FACETS.POLICY,
]

function listToText(list) {
  return (list || []).join(', ')
}

function textToList(text) {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function ProfileEditForm({ profile, onSaved, onCancel }) {
  const [form, setForm] = useState({
    title: '',
    professional_title: '',
    specialty_area: '',
    career_level: '',
    primary_lens: '',
    identity_facets: [],
    bio: '',
    expertise_tags: '',
    skills: '',
    orcid_id: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    const facets = profile.identity_facets?.length
      ? [...profile.identity_facets]
      : [IDENTITY_FACETS.RESEARCHER]
    setForm({
      title: profile.title || '',
      professional_title: profile.professional_title || '',
      specialty_area: profile.specialty_area || SPECIALTY_AREAS[0],
      career_level: profile.career_level || CAREER_LEVELS.MID,
      primary_lens: facets.includes(profile.primary_lens) ? profile.primary_lens : facets[0],
      identity_facets: facets,
      bio: profile.bio || '',
      expertise_tags: listToText(profile.expertise_tags),
      skills: listToText(profile.skills),
      orcid_id: profile.orcid_id || '',
    })
  }, [profile])

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Job title is required')
      return
    }
    if (form.identity_facets.length === 0) {
      toast.error('Select at least one identity')
      return
    }
    if (
      form.identity_facets.includes(IDENTITY_FACETS.PROFESSIONAL_TECHNICAL) &&
      !form.professional_title.trim()
    ) {
      toast.error('Add a professional title (e.g. Biostatistician)')
      return
    }

    setSaving(true)
    try {
      const { data } = await api.patch('/directory/me', {
        title: form.title.trim(),
        professional_title: form.professional_title.trim() || null,
        specialty_area: form.specialty_area,
        career_level: form.career_level || null,
        identity_facets: form.identity_facets,
        primary_lens: form.primary_lens,
        bio: form.bio,
        expertise_tags: textToList(form.expertise_tags),
        skills: textToList(form.skills),
        orcid_id: form.orcid_id.trim() || null,
      })
      toast.success('Profile updated')
      onSaved?.(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  const showProfessionalTitle = form.identity_facets.includes(
    IDENTITY_FACETS.PROFESSIONAL_TECHNICAL,
  )

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 p-5 rounded-2xl border border-rhip-teal/30 bg-white space-y-4 print:hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-rhip-dark">Edit profile</h2>
          <p className="text-xs text-rhip-muted mt-0.5">
            Update how you appear in Directory, Map, and Challenge matching.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-rhip-muted hover:text-rhip-dark"
        >
          Cancel
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Job title</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Specialty</label>
          <select
            value={form.specialty_area}
            onChange={(e) => setForm({ ...form, specialty_area: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal bg-white"
          >
            {SPECIALTY_AREAS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Career level</label>
          <select
            value={form.career_level}
            onChange={(e) => setForm({ ...form, career_level: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal bg-white"
          >
            {Object.values(CAREER_LEVELS).map((level) => (
              <option key={level} value={level}>{CAREER_LEVEL_LABELS[level]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Primary focus</label>
          <select
            value={form.primary_lens}
            onChange={(e) => setForm({ ...form, primary_lens: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal bg-white"
          >
            {form.identity_facets.map((facet) => (
              <option key={facet} value={facet}>{IDENTITY_FACET_LABELS[facet]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Identities (select all that apply)</label>
        <div className="flex flex-wrap gap-3">
          {FACET_OPTIONS.map((facet) => (
            <label key={facet} className="inline-flex items-center gap-2 text-sm text-rhip-body">
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

      {showProfessionalTitle && (
        <div>
          <label className="block text-sm font-medium mb-1">Professional title</label>
          <input
            value={form.professional_title}
            onChange={(e) => setForm({ ...form, professional_title: e.target.value })}
            placeholder="e.g. Biostatistician, Registry manager"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">ORCID iD (optional override)</label>
        <input
          value={form.orcid_id}
          onChange={(e) => setForm({ ...form, orcid_id: e.target.value })}
          placeholder="0000-0001-2345-6789"
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal font-mono"
        />
        <p className="text-xs text-rhip-muted mt-1">
          Leave blank to auto-link from ORCID when your name/institution uniquely matches.
          Paste your iD if auto-link misses (emails on ORCID are usually private).
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Bio</label>
        <textarea
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          rows={5}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Expertise tags</label>
          <input
            value={form.expertise_tags}
            onChange={(e) => setForm({ ...form, expertise_tags: e.target.value })}
            placeholder="Comma-separated topics"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
          />
          <p className="text-xs text-rhip-muted mt-1">Knowledge topics, e.g. TMS, rare disease</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Skills</label>
          <input
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
            placeholder="Comma-separated capabilities"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rhip-teal"
          />
          <p className="text-xs text-rhip-muted mt-1">Capabilities, e.g. biostatistics, data visualisation</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-rhip-teal text-white rounded-xl text-sm font-medium hover:bg-rhip-seafoam disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 border border-gray-200 text-rhip-body rounded-xl text-sm font-medium hover:bg-rhip-lightBg"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
