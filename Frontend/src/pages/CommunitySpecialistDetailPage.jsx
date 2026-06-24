import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  PhoneIcon,
  MapPinIcon,
  BuildingOffice2Icon,
  EnvelopeIcon,
  ClockIcon,
  LanguageIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline'
import api from '../hooks/useApi'
import PublicNavBar from '../components/layout/PublicNavBar'
import CommunityNav from '../components/layout/CommunityNav'
import SpecialistListItem from '../components/ui/SpecialistListItem'
import { parseProfileName } from '../utils/profile'

export default function CommunitySpecialistDetailPage() {
  const { slug } = useParams()
  const [specialist, setSpecialist] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .get(`/community/specialists/${slug}`)
      .then((res) => setSpecialist(res.data))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-rhip-lightBg">
        <PublicNavBar />
        <CommunityNav />
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="bg-white rounded-2xl h-96 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!specialist) {
    return (
      <div className="min-h-screen bg-rhip-lightBg">
        <PublicNavBar />
        <CommunityNav />
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <p className="text-rhip-body font-medium">Specialist not found</p>
          <Link to="/community/specialists" className="text-rhip-teal text-sm hover:underline mt-2 inline-block">
            Back to specialists
          </Link>
        </div>
      </div>
    )
  }

  const { honorific, displayName } = parseProfileName(specialist.name)

  return (
    <div className="min-h-screen bg-rhip-lightBg">
      <PublicNavBar />
      <CommunityNav />

      <section className="bg-rhip-dark px-6 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-24 h-24 bg-rhip-lightTeal rounded-full flex items-center justify-center shrink-0">
              <span className="text-rhip-teal font-bold text-3xl">
                {displayName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </span>
            </div>
            <div className="flex-1">
              {honorific && (
                <p className="text-xs uppercase tracking-wide text-rhip-muted mb-1">{honorific}</p>
              )}
              <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
                {displayName}
              </h1>
              <p className="text-rhip-ice text-lg">{specialist.title}</p>
              {specialist.department && (
                <p className="text-sm text-rhip-muted mt-2">{specialist.department}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {(specialist.specialties || []).map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-white/10 text-rhip-ice text-sm rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
              {specialist.accepting_referrals && (
                <p className="inline-flex items-center gap-1.5 mt-4 text-sm text-rhip-teal">
                  <CheckBadgeIcon className="w-4 h-4" />
                  Accepting referrals
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-10 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {specialist.bio && (
            <section className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8">
              <h2 className="font-display text-xl font-semibold text-rhip-dark mb-4">About</h2>
              <p className="text-rhip-body leading-relaxed whitespace-pre-line">{specialist.bio}</p>
            </section>
          )}

          {specialist.service_name && (
            <section className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8">
              <h2 className="font-display text-xl font-semibold text-rhip-dark mb-3">Department</h2>
              <Link
                to={`/community/services/${specialist.service_slug}`}
                className="text-rhip-teal font-medium hover:underline"
              >
                {specialist.service_name}
              </Link>
              <p className="text-sm text-rhip-muted mt-2">
                View contact details, team members, and patient resources for this service.
              </p>
            </section>
          )}

          {(specialist.related_specialists || []).length > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold text-rhip-dark mb-4">
                Colleagues in this department
              </h2>
              <div className="space-y-3">
                {specialist.related_specialists.map((s) => (
                  <SpecialistListItem key={s.id} specialist={s} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 className="font-display text-lg font-semibold text-rhip-dark">Contact</h2>

            <div className="flex items-start gap-3">
              <BuildingOffice2Icon className="w-5 h-5 text-rhip-teal shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide">Facility</p>
                <p className="text-sm text-rhip-body">{specialist.facility_name}</p>
              </div>
            </div>

            {specialist.address && (
              <div className="flex items-start gap-3">
                <MapPinIcon className="w-5 h-5 text-rhip-teal shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide">Address</p>
                  <p className="text-sm text-rhip-body">{specialist.address}</p>
                </div>
              </div>
            )}

            {specialist.phone && (
              <div className="flex items-start gap-3">
                <PhoneIcon className="w-5 h-5 text-rhip-teal shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide">Phone</p>
                  <a href={`tel:${specialist.phone.replace(/\s/g, '')}`} className="text-sm text-rhip-teal hover:underline">
                    {specialist.phone}
                  </a>
                </div>
              </div>
            )}

            {specialist.email && (
              <div className="flex items-start gap-3">
                <EnvelopeIcon className="w-5 h-5 text-rhip-teal shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide">Email</p>
                  <a href={`mailto:${specialist.email}`} className="text-sm text-rhip-teal hover:underline break-all">
                    {specialist.email}
                  </a>
                </div>
              </div>
            )}

            {specialist.clinic_hours && (
              <div className="flex items-start gap-3">
                <ClockIcon className="w-5 h-5 text-rhip-teal shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide">Clinic hours</p>
                  <p className="text-sm text-rhip-body">{specialist.clinic_hours}</p>
                </div>
              </div>
            )}

            {(specialist.languages || []).length > 0 && (
              <div className="flex items-start gap-3">
                <LanguageIcon className="w-5 h-5 text-rhip-teal shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-rhip-muted uppercase tracking-wide">Languages</p>
                  <p className="text-sm text-rhip-body">{specialist.languages.join(', ')}</p>
                </div>
              </div>
            )}
          </div>

          {specialist.profile_id && (
            <div className="bg-rhip-lightTeal rounded-2xl p-6">
              <p className="text-sm text-rhip-body mb-3">
                This specialist is also part of the RHIP research community.
              </p>
              <Link
                to="/auth/login"
                className="inline-flex w-full justify-center px-5 py-2.5 bg-rhip-teal text-white rounded-full text-sm font-medium hover:bg-rhip-seafoam transition-colors"
              >
                Log in to view research profile
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
