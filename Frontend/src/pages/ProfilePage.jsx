import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { format, parseISO } from 'date-fns'
import api from '../hooks/useApi'
import { parseProfileName } from '../utils/profile'
import {
  EmptySection,
  getObserverRoot,
  PROFILE_SECTIONS,
  ProfileSection,
  ProfileSectionNav,
  ProfileSummaryBar,
  scrollToSection,
} from '../components/profile/ProfileLayout'

const STAGE_LABELS = {
  1: 'Discovery',
  2: 'Validation',
  3: 'Prototype',
  4: 'Clinical feasibility',
  5: 'Clinical trial',
  6: 'Regulatory',
  7: 'Commercialisation',
  8: 'Adopted',
  9: 'Scaled',
  10: 'Sustained',
}

function formatNewsDate(dateStr) {
  try {
    return format(parseISO(dateStr), 'd MMMM yyyy')
  } catch {
    return dateStr
  }
}

export default function ProfilePage() {
  const { profileId } = useParams()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeSection, setActiveSection] = useState('overview')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
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
  }, [profileId])

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
  const projects = profile.projects || []
  const patents = profile.patents || []
  const news = profile.news || []
  const awards = profile.awards || []

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
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
          {honorific && (
            <span className="text-sm font-medium uppercase tracking-wide text-rhip-muted">
              {honorific}
            </span>
          )}
          <h1 className="font-display text-3xl md:text-4xl font-bold text-rhip-dark">
            {displayName}
          </h1>
        </div>
        <p className="text-lg text-rhip-body mb-1">{profile.title}</p>
        {profile.institution_name && (
          <p className="text-sm text-rhip-muted mb-4">{profile.institution_name}</p>
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

      <ProfileSummaryBar profile={profile} firstName={firstName} />

      {/* Sidebar + content */}
      <div className="grid lg:grid-cols-[220px_1fr] gap-8 items-start">
        <div className="lg:sticky lg:top-6">
          <ProfileSectionNav activeSection={activeSection} onNavigate={navigateToSection} />
        </div>

        <div className="min-w-0">
          <ProfileSection id="overview" title="Overview">
            <div className="space-y-4 text-rhip-body leading-relaxed font-display">
              {bioParagraphs.length > 0 ? (
                bioParagraphs.map((para) => <p key={para.slice(0, 40)}>{para}</p>)
              ) : (
                <EmptySection message="No overview available." />
              )}
            </div>
          </ProfileSection>

          <ProfileSection id="highlights" title="Highlights">
            {tags.length > 0 ? (
              <ul className="space-y-2 text-sm text-rhip-body">
                {tags.slice(0, 5).map((tag) => (
                  <li key={tag} className="flex items-start gap-2">
                    <span className="text-rhip-teal mt-0.5">•</span>
                    <span>
                      Leading research in <strong>{tag}</strong> within {profile.specialty_area}.
                    </span>
                  </li>
                ))}
                <li className="flex items-start gap-2">
                  <span className="text-rhip-teal mt-0.5">•</span>
                  <span>
                    {profile.publications} publications and {profile.active_projects} active
                    {' '}research projects across the RHIP precinct.
                  </span>
                </li>
              </ul>
            ) : (
              <EmptySection message="No highlights listed." />
            )}
          </ProfileSection>

          <ProfileSection id="study-with-me" title="Study With Me">
            <p className="text-sm text-rhip-body leading-relaxed">
              {firstName} is available to supervise HDR students and collaborate with visiting
              researchers in <strong>{profile.specialty_area}</strong>. Enquiries about supervision,
              co-supervision, or joint research projects are welcome through RHIP Connect.
            </p>
          </ProfileSection>

          <ProfileSection id="insights" title="Insights">
            {tags.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {tags.map((tag) => (
                  <div
                    key={tag}
                    className="p-4 border border-gray-200 rounded-lg bg-rhip-lightBg/50"
                  >
                    <p className="text-sm font-medium text-rhip-dark mb-1">{tag}</p>
                    <p className="text-xs text-rhip-muted">
                      Core research theme in {profile.specialty_area}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptySection message="No research insights listed." />
            )}
          </ProfileSection>

          <ProfileSection id="patents" title="Patents">
            {patents.length > 0 ? (
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
            ) : (
              <EmptySection message="No patents listed on this profile." />
            )}
          </ProfileSection>

          <ProfileSection id="projects" title="Projects">
            {projects.length > 0 ? (
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {projects.map((project) => (
                  <li key={project.id} className="p-4 bg-white hover:bg-rhip-lightBg/40 transition-colors">
                    <Link to="/pipeline" className="group block">
                      <p className="text-sm font-medium text-rhip-dark group-hover:text-rhip-teal transition-colors">
                        {project.title}
                      </p>
                      <p className="text-xs text-rhip-muted mt-1 line-clamp-2">{project.description}</p>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-rhip-muted">
                        <span>{STAGE_LABELS[project.stage] || `Stage ${project.stage}`}</span>
                        <span>{project.specialty_area}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptySection message="No projects listed on this profile." />
            )}
          </ProfileSection>

          <ProfileSection id="scholarly-works" title="Scholarly Works">
            <p className="text-sm text-rhip-body mb-4">
              <strong>{profile.publications}</strong> indexed scholarly works across{' '}
              {profile.specialty_area.toLowerCase()}.
            </p>
            {tags.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-2">
                  Research focus areas
                </p>
                <ul className="space-y-1">
                  {tags.map((tag) => (
                    <li key={tag} className="text-sm text-rhip-body">
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ProfileSection>

          <ProfileSection id="news" title="News">
            {news.length > 0 ? (
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
            ) : (
              <EmptySection message="No news items listed on this profile." />
            )}
          </ProfileSection>

          <ProfileSection id="awards" title="Awards">
            {awards.length > 0 ? (
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
            ) : (
              <EmptySection message="No awards listed on this profile." />
            )}
          </ProfileSection>

          <ProfileSection id="credentials" title="Credentials">
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-1">
                  Position
                </dt>
                <dd className="text-rhip-body">{profile.title}</dd>
              </div>
              {profile.institution_name && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-1">
                    Institution
                  </dt>
                  <dd className="text-rhip-body">{profile.institution_name}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-1">
                  Primary research area
                </dt>
                <dd className="text-rhip-body">{profile.specialty_area}</dd>
              </div>
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
