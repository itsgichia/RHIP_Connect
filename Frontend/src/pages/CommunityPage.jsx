import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BuildingOffice2Icon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import api from '../hooks/useApi'
import PublicNavBar from '../components/layout/PublicNavBar'
import CommunityNav from '../components/layout/CommunityNav'
import StatCard from '../components/ui/StatCard'
import ServiceCard from '../components/ui/ServiceCard'

const DISTRICT_SLUG = 'seslhd-randwick'

export default function CommunityPage() {
  const [district, setDistrict] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/community/districts/${DISTRICT_SLUG}`),
      api.get(`/community/services?district=${DISTRICT_SLUG}`),
    ])
      .then(([districtRes, servicesRes]) => {
        setDistrict(districtRes.data)
        setServices(servicesRes.data.services.slice(0, 3))
      })
      .finally(() => setLoading(false))
  }, [])

  const metrics = district?.metrics

  return (
    <div className="min-h-screen bg-rhip-lightBg">
      <PublicNavBar />
      <CommunityNav />

      <section className="bg-rhip-dark px-6 py-16 md:py-20">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-rhip-teal text-sm font-medium uppercase tracking-wide mb-3">
            For Community
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
            Randwick Health Services
          </h1>
          <p className="text-rhip-ice text-base md:text-lg max-w-2xl mx-auto">
            Explore health district metrics, clinical services, and specialists across the
            Randwick Health &amp; Innovation Precinct.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-32 animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <section className="max-w-6xl mx-auto px-6 py-12">
            <h2 className="font-display text-2xl font-semibold text-rhip-dark mb-2">
              Health District at a Glance
            </h2>
            <p className="text-rhip-muted text-sm mb-8">
              {district?.description}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <StatCard label="Facilities" value={metrics?.facility_count ?? '—'} />
              <StatCard label="Clinical Services" value={metrics?.service_count ?? '—'} />
              <StatCard label="Specialists" value={metrics?.specialist_count ?? '—'} />
              <StatCard
                label="Patient Interactions / Year"
                value={
                  metrics?.kpis?.find((k) => k.metric_name === 'patient_interactions')
                    ?.display_value ?? '1.8M+'
                }
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {(metrics?.kpis ?? [])
                .filter((k) => k.metric_name !== 'patient_interactions')
                .slice(0, 6)
                .map((kpi) => (
                  <div key={kpi.id} className="bg-white rounded-2xl p-5 shadow-sm text-center">
                    <p className="font-display text-xl font-bold text-rhip-teal mb-1">
                      {kpi.display_value}
                    </p>
                    <p className="text-xs text-rhip-muted">{kpi.display_label}</p>
                  </div>
                ))}
            </div>
          </section>

          <section className="bg-white px-6 py-12">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-rhip-dark mb-1">
                    Our Facilities
                  </h2>
                  <p className="text-sm text-rhip-muted">
                    Major hospitals and centres in Randwick
                  </p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {(district?.facilities ?? []).map((facility) => (
                  <div
                    key={facility.id}
                    className="border border-gray-100 rounded-2xl p-6 hover:border-rhip-teal/20 transition-colors"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <BuildingOffice2Icon className="w-6 h-6 text-rhip-teal shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-display text-lg font-semibold text-rhip-dark">
                          {facility.name}
                        </h3>
                        <p className="text-sm text-rhip-muted mt-1">{facility.address}</p>
                      </div>
                    </div>
                    <p className="text-sm text-rhip-body mb-3">{facility.description}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-rhip-muted">
                      {facility.phone && <span>{facility.phone}</span>}
                      <span>{facility.service_count} services</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto px-6 py-12">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="font-display text-2xl font-semibold text-rhip-dark mb-1">
                  Clinical Services
                </h2>
                <p className="text-sm text-rhip-muted">
                  Browse departments and outpatient services
                </p>
              </div>
              <Link to="/community/services" className="text-rhip-teal font-medium text-sm hover:underline">
                View all services →
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </section>

          <section className="bg-rhip-dark px-6 py-12">
            <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="font-display text-2xl font-semibold text-white mb-3">
                  Find a Specialist
                </h2>
                <p className="text-rhip-ice text-sm leading-relaxed mb-6">
                  Search our directory of specialists practising at Randwick campus facilities.
                  Filter by name, specialty, or department.
                </p>
                <Link
                  to="/community/specialists"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-rhip-teal text-white rounded-full font-medium hover:bg-rhip-seafoam transition-colors"
                >
                  <UserGroupIcon className="w-5 h-5" />
                  Browse Our Specialists
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-2xl p-6 text-center">
                  <ClipboardDocumentListIcon className="w-8 h-8 text-rhip-teal mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{metrics?.service_count ?? 0}</p>
                  <p className="text-xs text-rhip-ice">Services listed</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-6 text-center">
                  <UserGroupIcon className="w-8 h-8 text-rhip-teal mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{metrics?.specialist_count ?? 0}</p>
                  <p className="text-xs text-rhip-ice">Specialists in Randwick</p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <footer className="bg-rhip-dark px-6 py-8 border-t border-white/10">
        <p className="text-center text-rhip-muted text-xs">© 2026 RHIP Connect</p>
      </footer>
    </div>
  )
}
