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
  {
    name: 'UNSW Sydney',
    href: 'https://www.unsw.edu.au',
  },
  {
    name: 'SESLHD',
    href: 'https://www.seslhd.health.nsw.gov.au/',
  },
  {
    name: 'Prince of Wales Hospital',
    href: 'https://www.seslhd.health.nsw.gov.au/prince-of-wales-hospital',
  },
  {
    name: "Sydney Children's Hospital",
    href: 'https://www.schn.health.nsw.gov.au/sydney-childrens-hospital-randwick',
  },
  { name: 'NeuRA', href: 'https://www.neura.edu.au/' },
  { name: 'Black Dog Institute', href: 'https://www.blackdoginstitute.org.au/' },
  { name: 'George Institute for Global Health', href: 'https://www.georgeinstitute.org.au/' },
  { name: "Children's Cancer Institute", href: 'https://www.ccia.org.au' },
]

// ---------------------------------------------------------------------------
// "Inside the precinct" content — all grounded in official RHIP material so it
// stays verifiable (not made up):
//   - Vision:        https://rhip.org.au/about/strategy
//   - New buildings: RHIP "Amplifying the Impact" deck (NEW BUILDINGS slide)
//   - Milestones:    RHIP deck (RHIP Evolution 2016–2021) + UNSW/NSW Gov
//   - News:          https://rhip.org.au/news-publications  (links out — always current)
// ---------------------------------------------------------------------------

// Short vision line + strategic pillars (from RHIP strategy page).
const RHIP_VISION =
  'Our vision is to be a world-class precinct, collaboratively creating transformational change ' +
  'across research, education and health outcomes.'

// The four pillars of RHIP's draft 2026-2030 strategy.
const RHIP_PILLARS = [
  'Accelerate translation',
  'Attract investment, industry & talent',
  'Make the precinct work as one',
  'Strengthen profile, voice & recognition',
]

// RHIP's four speciality areas (source: RHIP deck "SPECIALITY AREAS" slide).
// These match the specialty_area values used in the researcher directory.
const RHIP_SPECIALTIES = [
  {
    area: 'Mental Health & Neuroscience',
    blurb: 'Brain, mind and mental-health research and care, spanning neuroscience and drug & alcohol research.',
  },
  {
    area: 'Personalised Medicine',
    blurb: 'Precision oncology and tailored treatments for both adults and children.',
  },
  {
    area: 'Rare Diseases',
    blurb: 'Diagnosis, care and research for rare and complex conditions.',
  },
  {
    area: 'Health Systems',
    blurb: 'Designing better models of care and the future of health systems.',
  },
]

// Optional intro video. Paste a YouTube/Vimeo EMBED url, e.g.
// 'https://www.youtube.com/embed/VIDEO_ID'. Leave '' to hide the video block.
const RHIP_VIDEO_URL = ''

// The precinct's three new landmark buildings (source: RHIP deck).
// Photos live in  Frontend/public/LandingPageImages/RHIP/ .
const RHIP_BUILDINGS = [
  {
    name: 'UNSW Health Translation Hub',
    opened: '2025',
    focus: 'Education, innovation & translation',
    specs: ['6 industry floors', '35,000 m²', '$600M'],
    image: '/LandingPageImages/RHIP/hth-exterior.jpg',
  },
  {
    name: 'Prince of Wales Hospital Acute Services Building',
    opened: '2023',
    focus: 'Clinical care',
    specs: ['388 beds', '55,000 m²', '$870M'],
    image: '/LandingPageImages/RHIP/prince-of-wales.jpg',
  },
  {
    name: "Sydney Children's Hospital & Minderoo Children's Comprehensive Cancer Centre (Bilima)",
    opened: '2025',
    focus: 'Specialised care & research',
    specs: ['340 beds', '36,000 m²', '$658M'],
    image: '/LandingPageImages/RHIP/childrens-hospital.png',
  },
]

// Precinct journey (sources: RHIP deck "RHIP Evolution", UNSW Newsroom, NSW Gov).
const RHIP_MILESTONES = [
  {
    date: '1858',
    title: 'Prince of Wales origins',
    blurb:
      'The Society for the Relief of Destitute Children opens an asylum in Randwick. The site is officially named Prince of Wales Hospital in 1953.',
  },
  {
    date: '1949',
    title: 'UNSW established',
    blurb:
      'UNSW is incorporated by an Act of Parliament, with roots tracing back to the 1843 Sydney Mechanics’ Institute.',
  },
  {
    date: '2016',
    title: 'Randwick collaboration agreement signed',
    blurb:
      'Partners sign the Collaboration Agreement to work more closely together toward a long-term vision. The NSW Government announces $500M for the Prince of Wales Acute Services Building.',
  },
  {
    date: '2018',
    title: '$250M for the Health Translation Hub',
    blurb:
      'UNSW announces a $250M investment in the Health Translation Hub, anchoring the precinct’s new home for education, innovation and translation.',
  },
  {
    date: '2019',
    title: '$608M for children’s health',
    blurb:
      'The NSW Government announces $608M for Sydney Children’s Hospital Stage 1 and the Children’s Comprehensive Cancer Centre.',
  },
  {
    date: '2021',
    title: 'Collaboration agreement renewed',
    blurb:
      'The RHIP Collaboration Agreement is formalised, including collaborative partner investment, to take the partnership to the next level.',
  },
]

// News & events — we link straight to RHIP's own pages instead of copying
// their content, so it's always current and accurate (never stale).
const RHIP_LINKS = [
  {
    label: 'News & Publications',
    desc: 'Latest announcements, publications and stories from across the precinct.',
    href: 'https://rhip.org.au/news-publications',
  },
  {
    label: "What's on at RH&IP",
    desc: 'Upcoming events, seminars and webinars happening across the precinct.',
    href: 'https://rhip.org.au/events',
  },
]

const FOOTER_LINKS = [
  { label: 'Community Health Services', to: '/community' },
  { label: 'Government Impact Dashboard', to: '/government' },
  { label: 'Clinical Services', to: '/community/services' },
  { label: 'Find a Specialist', to: '/community/specialists' },
  { label: 'Expertise Directory', to: '/auth/login?redirect=/directory' },
  { label: 'Randwick Health Precinct', href: 'https://www.health.nsw.gov.au/research/Pages/randwick-health-innovation-precinct.aspx' },
  { label: 'Health Translation Hub', href: 'https://www.health.nsw.gov.au/research/Pages/health-translation-hub.aspx' },
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
      <section
        className="relative bg-rhip-dark bg-cover bg-center px-6 py-20 md:py-28"
        style={{
          backgroundImage:
            'linear-gradient(rgba(10,25,41,0.78), rgba(10,25,41,0.85)), url(/LandingPageImages/RHIP/hero-precinct.jpg)',
        }}
      >
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
            <h2 className="font-display text-3xl font-semibold text-rhip-dark mb-4">About RH&IP</h2>
            <p className="text-rhip-body leading-relaxed mb-4">
              The Randwick Health &amp; Innovation Precinct brings together UNSW Sydney, South Eastern
              Sydney Local Health District, and Sydney Children&apos;s Hospitals Network in a co-located
              ecosystem where research, clinical care, and industry innovation converge.
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-4 mt-6">
  <div>
    <p className="font-display text-2xl font-bold text-rhip-teal">3</p>
    <p className="text-xs text-rhip-muted">major teaching hospitals</p>
  </div>
  <div>
    <p className="font-display text-2xl font-bold text-rhip-teal">4</p>
    <p className="text-xs text-rhip-muted">medical research institutes</p>
  </div>
  <div>
    <p className="font-display text-2xl font-bold text-rhip-teal">Top 20</p>
    <p className="text-xs text-rhip-muted">UNSW, ranked globally</p>
  </div>
</div>
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

      {/* Inside the precinct — vision, new buildings, milestones, news */}
      <section className="bg-white px-6 pb-20">
        <div className="max-w-6xl mx-auto">
          {/* Vision + strategic pillars */}
          <div className="max-w-3xl mb-14">
            <h2 className="font-display text-3xl font-semibold text-rhip-dark mb-4">
              Inside the precinct
            </h2>
            <p className="text-rhip-body leading-relaxed mb-4">{RHIP_VISION}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-2">
              Strategic pillars (2026-2030)
            </p>
            <div className="flex flex-wrap gap-2">
              {RHIP_PILLARS.map((p) => (
                <span
                  key={p}
                  className="px-3 py-1 rounded-full bg-rhip-lightBg text-rhip-body text-xs font-medium"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Optional intro video */}
          {RHIP_VIDEO_URL && (
            <div className="mb-14 max-w-3xl aspect-video rounded-2xl overflow-hidden bg-rhip-cardBg">
              <iframe
                src={RHIP_VIDEO_URL}
                title="About RHIP"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* Speciality areas */}
          <h3 className="font-display text-2xl font-semibold text-rhip-dark mb-6">Speciality areas</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {RHIP_SPECIALTIES.map((s) => (
              <div key={s.area} className="bg-rhip-lightBg rounded-2xl p-5">
                <h4 className="font-display text-base font-semibold text-rhip-dark mb-2">{s.area}</h4>
                <p className="text-sm text-rhip-body leading-relaxed">{s.blurb}</p>
              </div>
            ))}
          </div>

          {/* Milestones timeline (the journey of agreements & funding) */}
          <h3 className="font-display text-2xl font-semibold text-rhip-dark mb-6">Milestones</h3>
          <ol className="mb-16">
            {RHIP_MILESTONES.map((m, i) => (
              <li key={m.title} className="flex gap-4">
                {/* Rail: dot + connecting line */}
                <div className="flex flex-col items-center">
                  <span className="mt-5 w-4 h-4 rounded-full bg-rhip-teal ring-4 ring-white shrink-0" />
                  {i < RHIP_MILESTONES.length - 1 && (
                    <span className="w-0.5 flex-1 bg-rhip-lightTeal" />
                  )}
                </div>
                {/* Card */}
                <div className="flex-1 mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-rhip-lightBg text-rhip-teal text-xs font-semibold uppercase tracking-wide mb-2">
                    {m.date}
                  </span>
                  <h4 className="font-display text-base font-semibold text-rhip-dark mb-1">{m.title}</h4>
                  <p className="text-sm text-rhip-body leading-relaxed">{m.blurb}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* New buildings (the physical results of that investment) */}
          <h3 className="font-display text-2xl font-semibold text-rhip-dark mb-6">New Buildings</h3>
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {RHIP_BUILDINGS.map((b) => (
              <article
                key={b.name}
                className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="aspect-[4/3] bg-rhip-lightBg">
                  {b.image ? (
                    <img src={b.image} alt={b.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-rhip-muted text-xs">
                      Add photo
                    </span>
                  )}
                </div>
                <div className="flex flex-col flex-1 p-5">
                  <span className="self-start px-2.5 py-0.5 rounded-full bg-rhip-lightBg text-rhip-teal text-xs font-semibold uppercase tracking-wide mb-2">
                    Opened {b.opened}
                  </span>
                  <h4 className="font-display text-base font-semibold text-rhip-dark mb-1">
                    {b.name}
                  </h4>
                  <p className="text-sm text-rhip-muted mb-4">{b.focus}</p>
         <ul className="mt-auto flex flex-wrap gap-2 text-xs font-medium text-rhip-body">
  {b.specs.map((s) => (
    <li key={s} className="px-2.5 py-1 rounded-full bg-rhip-lightBg">
      {s}
    </li>
  ))}
</ul>
                </div>
              </article>
            ))}
          </div>

          {/* News & events (links straight to RHIP — always current) */}
          <h3 className="font-display text-2xl font-semibold text-rhip-dark mb-2">News &amp; events</h3>
          <p className="text-sm text-rhip-muted mb-6">Straight from RHIP — always up to date.</p>
          <div className="grid md:grid-cols-2 gap-6">
            {RHIP_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 bg-rhip-lightBg rounded-2xl p-6 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
              >
                <div>
                  <h4 className="font-display text-lg font-semibold text-rhip-dark mb-1">{l.label}</h4>
                  <p className="text-sm text-rhip-body leading-relaxed">{l.desc}</p>
                </div>
                <span className="shrink-0 text-xl text-rhip-teal transition-transform group-hover:translate-x-0.5">
                  →
                </span>
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
          {audience === 'government' && (
            <div className="text-center mt-8">
              <Link
                to="/government"
                className="inline-flex px-6 py-3 bg-rhip-teal text-white rounded-full font-medium hover:bg-rhip-seafoam transition-colors"
              >
                Explore impact dashboard →
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
                items: ['Coogee Beach (2km)', 'Randwick Junction', 'The Spot'],
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
            <p className="text-rhip-body leading-relaxed mb-6">
  The Hub's industry floors are designed for organisations that want to co-locate with
  the precinct's hospitals and research institutes, where discovery meets clinical practice.
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
            <p className="text-rhip-ice mb-3">The future of lifelong health</p>
            <p className="text-rhip-muted text-xs leading-relaxed">
              The Randwick Health &amp; Innovation Precinct is home to Prince of Wales Hospital,
              Sydney Children&apos;s Hospital and UNSW&apos;s Randwick campus.
            </p>
          </div>
          <div>
            <p className="font-medium text-white mb-3">Explore</p>
            <ul className="space-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  {link.to ? (
                    <Link to={link.to} className="text-rhip-ice hover:text-rhip-teal transition-colors">
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-rhip-ice hover:text-rhip-teal transition-colors"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-white mb-3">Connect</p>
            <ul className="space-y-2 text-rhip-ice">
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo('contact')}
                  className="hover:text-rhip-teal transition-colors text-left"
                >
                  Partner &amp; Investor Enquiries
                </button>
              </li>
              <li>
                <a
                  href="https://rhip.org.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-rhip-teal transition-colors"
                >
                  Randwick Health Precinct ebsite
                </a>
              </li>
              <li>
                <a
                  href="https://au.linkedin.com/company/randwick-health-innovation-precinct"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-rhip-teal transition-colors"
                >
                  LinkedIn
                </a>
              </li>
              <li>Randwick NSW 2031</li>
            </ul>
          </div>
        </div>
        <p className="text-center text-rhip-muted text-xs mt-8">
          © 2026 RHIP Connect
        </p>
      </footer>
    </div>
  )
}