import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { parseProfileName } from '../utils/profile'
import RoleBadge from '../components/ui/RoleBadge'
import ProfileEditForm from '../components/profile/ProfileEditForm'
import {
  getObserverRoot,
  PROFILE_SECTIONS,
  ProfileSection,
  ProfileSectionNav,
  ProfileSummaryBar,
  scrollToSection,
} from '../components/profile/ProfileLayout'
import { CAREER_LEVEL_LABELS, canViewPipeline } from '../utils/roles'

import { trlFullLabel, trlShortLabel } from '../utils/trl'

function formatNewsDate(dateStr) {
  try {
    return format(parseISO(dateStr), 'd MMMM yyyy')
  } catch {
    return dateStr
  }
}

export default function ProfilePage() {
  const { profileId } = useParams()
  const { user, updateUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeSection, setActiveSection] = useState('overview')
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [savingSkills, setSavingSkills] = useState(false)
  const [editing, setEditing] = useState(false)
  const [orcidWorks, setOrcidWorks] = useState(null)
  const [orcidLoading, setOrcidLoading] = useState(false)
  const [orcidError, setOrcidError] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setOrcidWorks(null)
      setOrcidError(null)
      try {
        const { data } = await api.get(`/directory/${profileId}`)
        setProfile(data)
      } catch {
        setError('Profile not found')
      } finally {
        setLoading(false)
      }
    }
    load()
    setEditing(false)
  }, [profileId])

  useEffect(() => {
    if (!profile?.id) {
      setOrcidWorks(null)
      setOrcidError(null)
      setOrcidLoading(false)
      return undefined
    }

    let cancelled = false
    const loadOrcid = async () => {
      setOrcidLoading(true)
      setOrcidError(null)
      try {
        const { data } = await api.get(`/orcid/profile/${profile.id}/works`)
        if (cancelled) return
        const resolvedId = data.orcid_id || null
        setOrcidWorks(data.works || [])
        if (resolvedId && resolvedId !== profile.orcid_id) {
          setProfile((prev) => (prev ? { ...prev, orcid_id: resolvedId } : prev))
        } else if (!resolvedId && profile.orcid_id) {
          setProfile((prev) => (prev ? { ...prev, orcid_id: null } : prev))
        }
      } catch (err) {
        if (!cancelled) {
          setOrcidWorks(null)
          setOrcidError(err.response?.data?.detail || 'Could not load ORCID works')
        }
      } finally {
        if (!cancelled) setOrcidLoading(false)
      }
    }
    loadOrcid()
    return () => {
      cancelled = true
    }
  }, [profile?.id, profile?.orcid_id])

  const togglePublic = async () => {
    if (!profile?.is_own_profile || savingVisibility) return
    setSavingVisibility(true)
    try {
      const { data } = await api.patch('/directory/me', { is_public: !profile.is_public })
      setProfile(data)
      toast.success(
        data.is_public
          ? 'You are now visible in Directory & Map'
          : 'Profile hidden from Directory & Map',
      )
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not update visibility')
    } finally {
      setSavingVisibility(false)
    }
  }

  const handleSuggestKeywords = async () => {
    if (!profile?.is_own_profile || suggesting) return
    setSuggesting(true)
    try {
      const { data } = await api.post('/directory/me/suggest-keywords')
      setSuggestions(data)
      toast.success('Suggestions ready, please review and apply below')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not suggest keywords')
    } finally {
      setSuggesting(false)
    }
  }

  const applySuggestions = async () => {
    if (!suggestions || savingSkills) return
    setSavingSkills(true)
    try {
      const expertise = [
        ...new Set([...(profile.expertise_tags || []), ...(suggestions.expertise_tags || [])]),
      ]
      const skills = [...new Set([...(profile.skills || []), ...(suggestions.skills || [])])]
      const { data } = await api.patch('/directory/me', {
        expertise_tags: expertise,
        skills,
      })
      setProfile(data)
      setSuggestions(null)
      toast.success('Tags and skills updated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not apply suggestions')
    } finally {
      setSavingSkills(false)
    }
  }

  useEffect(() => {
    if (!profile) return undefined

    const observerRoot = getObserverRoot()
    const observers = PROFILE_SECTIONS.map(({ id }) => {
      const el = document.getElementById(id)
      if (!el) return null

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id)
        },
        { root: observerRoot, rootMargin: '-10% 0px -55% 0px', threshold: 0 },
      )
      observer.observe(el)
      return observer
    })

    return () => observers.forEach((obs) => obs?.disconnect())
  }, [profile])

  const navigateToSection = useCallback((id) => {
    scrollToSection(id)
    setActiveSection(id)
  }, [])

  if (loading) {
    return <p className="text-rhip-muted">Loading profile...</p>
  }

  if (error || !profile) {
    return (
      <div className="max-w-3xl">
        <Link
          to="/directory"
          className="inline-flex items-center gap-2 text-sm text-rhip-teal hover:underline mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to directory
        </Link>
        <p className="text-rhip-muted">{error || 'Profile not found'}</p>
      </div>
    )
  }

  const { honorific, displayName } = parseProfileName(profile.name)
  const firstName = displayName.split(' ')[0]
  const bioParagraphs = profile.bio.split(/\n+/).filter(Boolean)
  const tags = profile.expertise_tags || []
  const skills = profile.skills || []
  const projects = profile.projects || []
  const patents = profile.patents || []
  const news = profile.news || []
  const awards = profile.awards || []
  const dbScholarlyWorks = profile.scholarly_works || []
  const useOrcidWorks = Array.isArray(orcidWorks) && orcidWorks.length > 0
  const scholarlyWorks = useOrcidWorks ? orcidWorks : dbScholarlyWorks
  const publicationCount = useOrcidWorks
    ? orcidWorks.length
    : profile.publications

  return (
    <div className="max-w-6xl profile-page">
      <Link
        to="/directory"
        className="inline-flex items-center gap-2 text-sm text-rhip-teal hover:underline mb-6 print:hidden"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Expertise Directory
      </Link>

      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
            {honorific && (
              <span className="text-sm font-medium uppercase tracking-wide text-rhip-muted">
                {honorific}
              </span>
            )}
            <h1 className="font-display text-3xl md:text-4xl font-bold text-rhip-dark">
              {displayName}
            </h1>
          </div>
          {profile.is_own_profile && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rhip-teal text-rhip-teal text-sm font-medium hover:bg-rhip-lightTeal print:hidden"
            >
              <PencilSquareIcon className="w-4 h-4" />
              Edit profile
            </button>
          )}
        </div>
        <p className="text-lg text-rhip-body mb-1">{profile.title}</p>
        {profile.institution_name && (
          <p className="text-sm text-rhip-muted mb-3">{profile.institution_name}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <RoleBadge facets={profile.identity_facets} />
          {profile.career_level && (
            <span
              className={
                profile.career_level === 'student'
                  ? 'text-sm px-2.5 py-0.5 rounded-full border border-rhip-teal/30 bg-rhip-lightTeal/40 text-rhip-teal'
                  : 'text-sm text-rhip-muted'
              }
            >
              {CAREER_LEVEL_LABELS[profile.career_level] || profile.career_level}
            </span>
          )}
          {profile.professional_title && (
            <span className="text-sm text-rhip-muted">{profile.professional_title}</span>
          )}
          {profile.orcid_id && (
            <a
              href={`https://orcid.org/${profile.orcid_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[#A6CE39] hover:underline font-mono"
              title="View ORCID record"
            >
              <svg className="w-4 h-4" viewBox="0 0 256 256" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0zm0 232.2C70.5 232.2 23.8 185.5 23.8 128S70.5 23.8 128 23.8 232.2 70.5 232.2 128 185.5 232.2 128 232.2z"
                />
                <path
                  fill="currentColor"
                  d="M86.3 68.9c0 6.3-5.1 11.4-11.4 11.4S63.5 75.2 63.5 68.9s5.1-11.4 11.4-11.4 11.4 5.1 11.4 11.4zM65.1 95.2h20.4v95.1H65.1V95.2zm118.1 41.7c0 26.8-17.2 41.7-46.1 41.7-10.2 0-20.7-2.3-28.8-6.5v22.2H88.1V95.2h20.1v8.6c7.8-6.1 18.1-9.9 29.1-9.9 28.5 0 45.9 15.1 45.9 42.9v.1zm-20.5-.3c0-15.4-9.4-25.4-25.7-25.4-9.4 0-17.5 4.5-22.7 11.2v39.1c5.4 3.5 12.6 5.5 20.6 5.5 15.9 0 27.8-9.6 27.8-30.4z"
                />
              </svg>
              {profile.orcid_id}
            </a>
          )}
        </div>
        {profile.is_own_profile && !editing && (
          <div className="mb-4 p-4 rounded-xl border border-gray-200 bg-white print:hidden">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!profile.is_public}
                disabled={savingVisibility}
                onChange={togglePublic}
                className="mt-1 rounded border-gray-300 text-rhip-teal focus:ring-rhip-teal"
              />
              <span>
                <span className="block text-sm font-medium text-rhip-dark">
                  Show me in Directory &amp; Map
                </span>
                <span className="block text-xs text-rhip-muted mt-0.5">
                  Opt in when you are ready — your profile stays private until you choose to appear.
                </span>
              </span>
            </label>
          </div>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-rhip-dark text-white text-xs rounded-full">
              {profile.specialty_area}
            </span>
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-rhip-lightBg text-rhip-body text-xs rounded-full border border-gray-200"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {profile.is_own_profile && editing && (
        <ProfileEditForm
          profile={profile}
          onSaved={(data) => {
            setProfile(data)
            setEditing(false)
            updateUser?.({
              identity_facets: data.identity_facets || [],
              primary_lens: data.primary_lens || null,
              career_level: data.career_level || null,
              profile_id: data.id,
            })
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      <ProfileSummaryBar profile={profile} firstName={firstName} />

      {/* Sidebar + content */}
      <div className="grid lg:grid-cols-[220px_1fr] gap-8 items-start">
        <div className="lg:sticky lg:top-6">
          <ProfileSectionNav activeSection={activeSection} onNavigate={navigateToSection} />
        </div>

        <div className="min-w-0">
          <ProfileSection id="overview" title="Overview">
            {bioParagraphs.length > 0 && (
              <div className="space-y-4 text-rhip-body leading-relaxed font-display">
                {bioParagraphs.map((para) => (
                  <p key={para.slice(0, 40)}>{para}</p>
                ))}
              </div>
            )}
          </ProfileSection>

          <ProfileSection id="highlights" title="Highlights">
            {tags.length > 0 && (
              <ul className="space-y-2 text-sm text-rhip-body">
                {tags.slice(0, 5).map((tag) => (
                  <li key={tag} className="flex items-start gap-2">
                    <span className="text-rhip-teal mt-0.5">•</span>
                    <span>{tag}</span>
                  </li>
                ))}
                {(profile.publications > 0 || profile.active_projects > 0) && (
                  <li className="flex items-start gap-2">
                    <span className="text-rhip-teal mt-0.5">•</span>
                    <span>
                      {[
                        profile.publications > 0 && `${profile.publications} publications`,
                        profile.active_projects > 0 &&
                          `${profile.active_projects} active research projects`,
                      ]
                        .filter(Boolean)
                        .join(' and ')}
                      .
                    </span>
                  </li>
                )}
              </ul>
            )}
          </ProfileSection>

          <ProfileSection id="skills" title="Skills">
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 bg-amber-50 text-amber-900 text-xs rounded-full border border-amber-100"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
            {profile.is_own_profile && (
              <div className="mt-4 p-4 rounded-xl border border-gray-200 bg-white space-y-3">
                <p className="text-sm text-rhip-muted">
                  Opt in to suggest skills and expertise from your publications. Nothing is saved until you confirm.
                </p>
                <button
                  type="button"
                  onClick={handleSuggestKeywords}
                  disabled={suggesting}
                  className="px-4 py-2 text-sm rounded-xl border border-rhip-teal text-rhip-teal hover:bg-rhip-lightTeal disabled:opacity-50"
                >
                  {suggesting ? 'Suggesting…' : 'Suggest from my publications'}
                </button>
                {suggestions && (
                  <div className="space-y-2">
                    {(suggestions.skills || []).length > 0 && (
                      <p className="text-xs text-rhip-muted">
                        Skills: {(suggestions.skills || []).join(', ')}
                      </p>
                    )}
                    {(suggestions.expertise_tags || []).length > 0 && (
                      <p className="text-xs text-rhip-muted">
                        Expertise: {(suggestions.expertise_tags || []).join(', ')}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={applySuggestions}
                      disabled={savingSkills}
                      className="px-4 py-2 text-sm rounded-xl bg-rhip-teal text-white hover:bg-rhip-seafoam disabled:opacity-50"
                    >
                      {savingSkills ? 'Saving…' : 'Apply suggestions'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </ProfileSection>

          <ProfileSection id="study-with-me" title="Study With Me" />

          <ProfileSection id="insights" title="Insights">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 text-sm text-rhip-dark border border-gray-200 rounded-lg bg-rhip-lightBg/50"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </ProfileSection>

          <ProfileSection id="patents" title="Patents">
            {patents.length > 0 && (
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {patents.map((patent) => (
                  <li key={`${patent.number}-${patent.title}`} className="p-4 bg-white">
                    <p className="text-sm font-medium text-rhip-dark">{patent.title}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-rhip-muted">
                      {patent.number && <span>{patent.number}</span>}
                      {patent.year && <span>{patent.year}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ProfileSection>

          <ProfileSection id="projects" title="Projects">
            {projects.length > 0 && (
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {projects.map((project) => (
                  <li key={project.id} className="p-4 bg-white hover:bg-rhip-lightBg/40 transition-colors">
                    {canViewPipeline(user?.role) ? (
                      <Link to="/pipeline" className="group block">
                        <p className="text-sm font-medium text-rhip-dark group-hover:text-rhip-teal transition-colors">
                          {project.title}
                        </p>
                        <p className="text-xs text-rhip-muted mt-1 line-clamp-2">{project.description}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-rhip-muted">
                          <span>{trlShortLabel(project.trl)} · {trlFullLabel(project.trl)}</span>
                          <span>{project.specialty_area}</span>
                        </div>
                      </Link>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-rhip-dark">{project.title}</p>
                        <p className="text-xs text-rhip-muted mt-1 line-clamp-2">{project.description}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-rhip-muted">
                          <span>{trlShortLabel(project.trl)} · {trlFullLabel(project.trl)}</span>
                          <span>{project.specialty_area}</span>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ProfileSection>

          <ProfileSection id="scholarly-works" title="Scholarly Works">
            {profile.orcid_id && (
              <p className="text-xs text-rhip-muted mb-3">
                Linked ORCID:{' '}
                <a
                  href={`https://orcid.org/${profile.orcid_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rhip-teal hover:underline font-mono"
                >
                  {profile.orcid_id}
                </a>
                {useOrcidWorks && ' · showing live ORCID works'}
              </p>
            )}
            {orcidLoading && (
              <p className="text-sm text-rhip-muted mb-4">Loading publications from ORCID…</p>
            )}
            {!orcidLoading && orcidError && !useOrcidWorks && (
              <p className="text-sm text-amber-800 mb-4">{orcidError}</p>
            )}
            {scholarlyWorks.length > 0 ? (
              <>
                {publicationCount > 0 && (
                  <p className="text-sm text-rhip-body mb-4">
                    <strong>{publicationCount}</strong>{' '}
                    {useOrcidWorks ? 'works from ORCID' : 'indexed scholarly works'}
                    {!useOrcidWorks && profile.specialty_area
                      ? ` across ${profile.specialty_area.toLowerCase()}`
                      : ''}
                    .
                  </p>
                )}
                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                  {scholarlyWorks.map((work) => (
                    <li key={work.id} className="p-4 bg-white">
                      {work.url ? (
                        <a
                          href={work.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-rhip-teal hover:underline"
                        >
                          {work.title}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-rhip-dark">{work.title}</p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-rhip-muted">
                        {work.journal && <span>{work.journal}</span>}
                        {work.year && <span>{work.year}</span>}
                        {work.pmid && <span>PMID {work.pmid}</span>}
                        {work.doi && <span>DOI {work.doi}</span>}
                      </div>
                      {work.authors?.length > 0 && (
                        <p className="text-xs text-rhip-muted mt-1 line-clamp-1">
                          {work.authors.slice(0, 4).join(', ')}
                          {work.authors.length > 4 ? ' et al.' : ''}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              !orcidLoading &&
              publicationCount > 0 && (
                <p className="text-sm text-rhip-body">
                  <strong>{publicationCount}</strong> indexed scholarly works
                  {profile.specialty_area
                    ? ` across ${profile.specialty_area.toLowerCase()}`
                    : ''}
                  .
                </p>
              )
            )}
          </ProfileSection>

          <ProfileSection id="news" title="News">
            {news.length > 0 && (
              <ul className="space-y-4">
                {news.map((item) => (
                  <li key={`${item.date}-${item.title}`} className="border-b border-gray-100 pb-4 last:border-b-0">
                    <p className="text-xs text-rhip-muted mb-1">{formatNewsDate(item.date)}</p>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-rhip-teal hover:underline"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-rhip-dark">{item.title}</p>
                    )}
                    <p className="text-sm text-rhip-body mt-1 leading-relaxed">{item.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </ProfileSection>

          <ProfileSection id="awards" title="Awards">
            {awards.length > 0 && (
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {awards.map((award) => (
                  <li key={`${award.year}-${award.title}`} className="p-4 bg-white">
                    <p className="text-sm font-medium text-rhip-dark">{award.title}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-rhip-muted">
                      <span>{award.organisation}</span>
                      <span>{award.year}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ProfileSection>

          <ProfileSection id="credentials" title="Credentials">
            <dl className="space-y-4 text-sm">
              {profile.title && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-1">
                    Position
                  </dt>
                  <dd className="text-rhip-body">{profile.title}</dd>
                </div>
              )}
              {profile.institution_name && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-1">
                    Institution
                  </dt>
                  <dd className="text-rhip-body">{profile.institution_name}</dd>
                </div>
              )}
              {profile.specialty_area && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-1">
                    Primary research area
                  </dt>
                  <dd className="text-rhip-body">{profile.specialty_area}</dd>
                </div>
              )}
              {tags.length > 0 && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-1">
                    Expertise
                  </dt>
                  <dd className="text-rhip-body">{tags.join(', ')}</dd>
                </div>
              )}
            </dl>
          </ProfileSection>
        </div>
      </div>
    </div>
  )
}
