import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  DocumentTextIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import api from '../hooks/useApi'
import PublicNavBar from '../components/layout/PublicNavBar'
import CommunityNav from '../components/layout/CommunityNav'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'contact', label: 'Contact Us' },
  { id: 'team', label: 'Our Team' },
  { id: 'resources', label: 'Patient Information & Resources' },
]

export default function CommunityServiceDetailPage() {
  const { slug } = useParams()
  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('overview')

  useEffect(() => {
    setLoading(true)
    api
      .get(`/community/services/${slug}`)
      .then((res) => setService(res.data))
      .finally(() => setLoading(false))
  }, [slug])

  const scrollTo = (id) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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

  if (!service) {
    return (
      <div className="min-h-screen bg-rhip-lightBg">
        <PublicNavBar />
        <CommunityNav />
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <p className="text-rhip-body font-medium">Service not found</p>
          <Link to="/community/services" className="text-rhip-teal text-sm hover:underline mt-2 inline-block">
            Back to services
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-rhip-lightBg">
      <PublicNavBar />
      <CommunityNav />

      <section className="bg-rhip-dark px-6 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-3 py-1 bg-rhip-teal/20 text-rhip-teal text-xs rounded-full mb-4">
            {service.specialty}
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
            {service.name}
          </h1>
          <p className="text-rhip-ice leading-relaxed">{service.summary}</p>
          <p className="text-sm text-rhip-muted mt-4">{service.facility_name}</p>
        </div>
      </section>

      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-3 flex flex-wrap gap-2">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollTo(id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeSection === id
                  ? 'bg-rhip-teal text-white'
                  : 'bg-rhip-lightBg text-rhip-body hover:bg-rhip-lightTeal'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
        <section id="overview" className="scroll-mt-24">
          <h2 className="font-display text-2xl font-semibold text-rhip-dark mb-4">Overview</h2>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8">
            <p className="text-rhip-body leading-relaxed whitespace-pre-line">{service.description}</p>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24">
          <h2 className="font-display text-2xl font-semibold text-rhip-dark mb-4">Contact Us</h2>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 space-y-4">
            {service.contact_phone && (
              <div className="flex items-start gap-3">
                <PhoneIcon className="w-5 h-5 text-rhip-teal shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-rhip-dark">Phone</p>
                  <p className="text-sm text-rhip-body">{service.contact_phone}</p>
                </div>
              </div>
            )}
            {service.contact_email && (
              <div className="flex items-start gap-3">
                <EnvelopeIcon className="w-5 h-5 text-rhip-teal shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-rhip-dark">Email</p>
                  <a href={`mailto:${service.contact_email}`} className="text-sm text-rhip-teal hover:underline">
                    {service.contact_email}
                  </a>
                </div>
              </div>
            )}
            {service.contact_address && (
              <div className="flex items-start gap-3">
                <MapPinIcon className="w-5 h-5 text-rhip-teal shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-rhip-dark">Address</p>
                  <p className="text-sm text-rhip-body">{service.contact_address}</p>
                </div>
              </div>
            )}
            {service.referral_info && (
              <div className="flex items-start gap-3 pt-4 border-t border-gray-100">
                <DocumentTextIcon className="w-5 h-5 text-rhip-teal shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-rhip-dark mb-1">Referral Pathways</p>
                  <p className="text-sm text-rhip-body leading-relaxed">{service.referral_info}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section id="team" className="scroll-mt-24">
          <h2 className="font-display text-2xl font-semibold text-rhip-dark mb-4">Our Team</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {(service.team || []).map((member) => (
              <div key={member.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-rhip-lightTeal rounded-full flex items-center justify-center shrink-0">
                    <UserGroupIcon className="w-5 h-5 text-rhip-teal" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-rhip-dark">{member.name}</h3>
                    {member.title && <p className="text-sm text-rhip-body">{member.title}</p>}
                    {member.role && <p className="text-xs text-rhip-muted mt-1">{member.role}</p>}
                    {member.phone && (
                      <p className="text-xs text-rhip-teal mt-2">{member.phone}</p>
                    )}
                    {member.profile_id && (
                      <Link
                        to={`/auth/login?redirect=/directory/${member.profile_id}`}
                        className="text-xs text-rhip-muted hover:text-rhip-teal mt-2 inline-block"
                      >
                        View research profile →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Link
              to={`/community/specialists?service=${service.slug}`}
              className="text-sm text-rhip-teal font-medium hover:underline"
            >
              View all specialists in this department →
            </Link>
          </div>
        </section>

        <section id="resources" className="scroll-mt-24">
          <h2 className="font-display text-2xl font-semibold text-rhip-dark mb-4">
            Patient Information &amp; Resources
          </h2>
          <div className="space-y-4">
            {(service.patient_resources || []).length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-rhip-muted">
                No resources listed for this service yet.
              </div>
            ) : (
              service.patient_resources.map((resource) => (
                <div key={resource.title} className="bg-white rounded-2xl border border-gray-100 p-6">
                  <h3 className="font-semibold text-rhip-dark mb-2">{resource.title}</h3>
                  <p className="text-sm text-rhip-body mb-3">{resource.description}</p>
                  {resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-rhip-teal hover:underline"
                    >
                      Read more →
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
