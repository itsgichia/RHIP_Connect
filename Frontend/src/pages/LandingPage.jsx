import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../hooks/useApi'
import PublicNavBar from '../components/layout/PublicNavBar'
import StatCard from '../components/ui/StatCard'
import ProjectCard from '../components/ui/ProjectCard'
import TenantEnquiryForm from '../components/forms/TenantEnquiryForm'
import InvestorContactForm from '../components/forms/InvestorContactForm'

const HERO_STATS = [
  { label: 'Research community members', value: '7,000+' },
  { label: 'Campus workforce', value: '22,000' },
  { label: 'Infrastructure investment', value: '$1.5B' },
  { label: 'Patient interactions per year', value: '1.8M+' },
]

const AUDIENCE_TABS = [
  { id: 'investor', label: 'For Investors' },
  { id: 'government', label: 'For Government' },
  { id: 'community', label: 'For Community' },
]

const PARTNER_LINKS = [
  { name: 'UNSW Sydney', href: 'https://www.unsw.edu.au/' },
  { name: 'NSW Health', href: 'https://www.health.nsw.gov.au/' },
  {
    name: "Sydney Children's Hospital",
    href: 'https://www.schn.health.nsw.gov.au/sydney-childrens-hospital-randwick',
  },
  { name: 'Neura', href: 'https://neura.edu.au/' },
  { name: 'Black Dog Institute', href: 'https://blackdoginstitute.org.au/' },
  { name: 'George Institute for Global Health', href: 'https://georgeinstitute.org.au/' },
  { name: 'Childrens Cancer Institute', href: 'https://www.childrenscancer.org.au/' },

]

function AnimatedCounter({ value }) {
  return <span>{value}</span>
}

export default function LandingPage() {
  const [audience, setAudience] = useState('investor')
  const [kpis, setKpis] = useState([])
  const [projects, setProjects] = useState([])
  const [hthOccupancy, setHthOccupancy] = useState(null)

  useEffect(() => {
    api.get(`/impact/kpis?audience=${audience}`).then((res) => setKpis(res.data))
  }, [audience])

  useEffect(() => {
    api.get('/impact/kpis?audience=investor').then((res) => {
      const occ = res.data.find((k) => k.metric_name === 'hth_occupancy')
      if (occ) setHthOccupancy(occ)
    })
    api.get('/pipeline/projects').then((res) => {
      const publicProjects = res.data.projects
        .filter((p) => p.stage >= 4 && p.stage <= 8)
        .sort((a, b) => b.stage - a.stage)
        .slice(0, 6)
      setProjects(publicProjects)
    })
  }, [])

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="min-h-screen">
      <PublicNavBar />

      {/* Hero */}
      <section className="bg-rhip-dark px-6 py-20 md:py-28">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            The Future of Lifelong Health
          </h1>
          <p className="text-rhip-ice text-lg md:text-xl mb-12">
            56 hectares. 22,000 people. One innovation ecosystem.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {HERO_STATS.map((s) => (
              <StatCard key={s.label} label={s.label} value={<AnimatedCounter value={s.value} />} />
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => scrollTo('about')}
              className="px-6 py-3 border border-rhip-ice text-rhip-ice rounded-full font-medium hover:bg-rhip-teal hover:border-rhip-teal hover:text-white transition-colors"
            >
              Explore the Precinct
            </button>
            <Link
              to="/auth/login"
              className="px-6 py-3 bg-rhip-teal text-white rounded-full font-medium hover:bg-rhip-seafoam transition-colors"
            >
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="bg-white px-6 py-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl font-semibold text-rhip-dark mb-4">About RHIP</h2>
            <p className="text-rhip-body leading-relaxed mb-4">
              The Randwick Health &amp; Innovation Precinct brings together UNSW Sydney, South Eastern
              Sydney Local Health District, and Sydney Children&apos;s Hospitals Network in a co-located
              ecosystem where research, clinical care, and industry innovation converge.
            </p>
            <p className="text-rhip-muted text-sm">
              3 major teaching hospitals · 4 medical research institutes · Top 19 globally (UNSW) and 1st in Australia (SES)
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {PARTNER_LINKS.map(({ name, href }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-4 bg-rhip-lightBg rounded-2xl text-center min-w-[140px] cursor-pointer transition-colors hover:bg-rhip-lightTeal hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rhip-teal"
              >
                <span className="font-semibold text-rhip-dark text-sm">{name}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="bg-rhip-lightBg px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl font-semibold text-rhip-dark text-center mb-8">
            Precinct Performance
          </h2>
          <div className="flex justify-center gap-2 mb-10 flex-wrap">
            {AUDIENCE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAudience(tab.id)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                  audience === tab.id
                    ? 'bg-rhip-teal text-white'
                    : 'bg-white text-rhip-body hover:bg-rhip-lightTeal'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {kpis
              .filter((k) => !['research_members', 'campus_workforce', 'infrastructure', 'patient_interactions'].includes(k.metric_name) || audience !== 'investor')
              .slice(0, 6)
              .map((kpi) => (
                <div key={kpi.id} className="bg-white rounded-2xl p-6 shadow-sm text-center">
                  <p className="font-display text-2xl font-bold text-rhip-teal mb-1">
                    {kpi.display_value}
                  </p>
                  <p className="text-sm text-rhip-muted">{kpi.display_label}</p>
                  {kpi.unit === '%' && (
                    <div className="mt-3 h-2 bg-rhip-cardBg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rhip-teal rounded-full"
                        style={{ width: `${kpi.value}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
          </div>
          {audience === 'community' && (
            <div className="text-center mt-8">
              <Link
                to="/community"
                className="inline-flex px-6 py-3 bg-rhip-teal text-white rounded-full font-medium hover:bg-rhip-seafoam transition-colors"
              >
                Explore Randwick health services →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Innovation */}
      <section className="bg-white px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl font-semibold text-rhip-dark mb-2">
            What&apos;s Being Built Right Now
          </h2>
          <p className="text-rhip-muted mb-10">Active projects from idea to clinical adoption</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/auth/login" className="text-rhip-teal font-medium hover:underline">
              View all projects →
            </Link>
          </div>
        </div>
      </section>

      {/* Precinct */}
      <section className="bg-rhip-dark px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl font-semibold text-white text-center mb-12">
            More Than a Campus
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Location & Connectivity',
                items: ['6km to Sydney CBD', '5km to Tech Central', 'Light rail & buses', '6km to Sydney Airport'],
              },
              {
                title: 'Lifestyle',
                items: ['Coogee Beach (2km)', 'Randwick Town Junction', 'The Spot dining precinct'],
              },
              {
                title: 'The Precinct',
                items: ['56 hectares', '4.2km contiguous border', 'UNSW Kensington Campus', 'Prince of Wales Hospital', "Sydney Children's Hospital", 'Health Translation Hub'],
              },
            ].map((col) => (
              <div key={col.title} className="text-center">
                <h3 className="font-display text-lg font-semibold text-rhip-teal mb-4">{col.title}</h3>
                <ul className="space-y-2">
                  {col.items.map((item) => (
                    <li key={item} className="text-rhip-ice text-sm">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HTH */}
      <section id="hth-section" className="bg-rhip-lightTeal px-6 py-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="font-display text-3xl font-semibold text-rhip-dark mb-4">
              The Health Translation Hub
            </h2>
            <p className="text-sm text-rhip-muted mb-4">Opened: 2025 | 35,000 m² | $600M investment</p>
            <p className="text-rhip-body leading-relaxed mb-6">
              Six dedicated industry floors designed for co-location with the precinct&apos;s hospitals
              and research institutes. Where discovery meets clinical practice.
            </p>
            <p className="text-sm text-rhip-muted mb-6">
              6 industry floors · Startup space · Education facilities · 35,000m² · Direct hospital connectivity
            </p>
            {hthOccupancy && (
              <div className="bg-white rounded-2xl p-6">
                <p className="text-sm font-medium text-rhip-body mb-2">Current Occupancy</p>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-rhip-teal font-bold">{hthOccupancy.display_value}</span>
                  <span className="text-rhip-muted">6 industry floors</span>
                </div>
                <div className="h-3 bg-rhip-cardBg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rhip-teal rounded-full"
                    style={{ width: `${hthOccupancy.value}%` }}
                  />
                </div>
                <p className="text-xs text-rhip-muted mt-2">2 floors currently available</p>
              </div>
            )}
          </div>
          <TenantEnquiryForm />
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-white px-6 py-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="font-display text-3xl font-semibold text-rhip-dark mb-4">Partner With Us</h2>
            <p className="text-rhip-body leading-relaxed mb-6">
              RHIP brings together the clinical scale, research capability, and infrastructure that
              industry and investors cannot access anywhere else in the Southern Hemisphere.
            </p>
            <ul className="space-y-2 text-sm text-rhip-body">
              {[
                'Access to a pipeline of 24+ investable projects',
                'Co-location in the Health Translation Hub',
                'Direct clinical trial partnerships',
                'IP licensing opportunities',
                'A 7,000-strong research talent pool',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-rhip-teal">✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <InvestorContactForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-rhip-dark px-6 py-12">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 text-sm">
          <div>
            <p className="font-display text-white font-semibold text-lg mb-1">RHIP Connect</p>
            <p className="text-rhip-ice">The future of lifelong health</p>
          </div>
          
        </div>
        <p className="text-center text-rhip-muted text-xs mt-8">
          © 2026 RHIP Connect
        </p>
      </footer>
    </div>
  )
}
