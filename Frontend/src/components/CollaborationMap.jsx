import { useEffect, useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import api from '../hooks/useApi'

// World map shapes (numeric ISO country ids)
const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// ISO alpha-2 (from OpenAlex) -> numeric ISO 3166 (used by the map shapes)
const ALPHA2_TO_NUM = {
  AD: 20, AE: 784, AF: 4, AG: 28, AL: 8, AM: 51, AO: 24, AR: 32, AT: 40, AU: 36,
  AZ: 31, BA: 70, BB: 52, BD: 50, BE: 56, BF: 854, BG: 100, BH: 48, BI: 108, BJ: 204,
  BN: 96, BO: 68, BR: 76, BS: 44, BT: 64, BW: 72, BY: 112, BZ: 84, CA: 124, CD: 180,
  CF: 140, CG: 178, CH: 756, CI: 384, CL: 152, CM: 120, CN: 156, CO: 170, CR: 188, CU: 192,
  CY: 196, CZ: 203, DE: 276, DJ: 262, DK: 208, DO: 214, DZ: 12, EC: 218, EE: 233, EG: 818,
  ER: 232, ES: 724, ET: 231, FI: 246, FJ: 242, FR: 250, GA: 266, GB: 826, GE: 268, GH: 288,
  GM: 270, GN: 324, GQ: 226, GR: 300, GT: 320, GW: 624, GY: 328, HN: 340, HR: 191, HT: 332,
  HU: 348, ID: 360, IE: 372, IL: 376, IN: 356, IQ: 368, IR: 364, IS: 352, IT: 380, JM: 388,
  JO: 400, JP: 392, KE: 404, KG: 417, KH: 116, KP: 408, KR: 410, KW: 414, KZ: 398, LA: 418,
  LB: 422, LK: 144, LR: 430, LS: 426, LT: 440, LU: 442, LV: 428, LY: 434, MA: 504, MD: 498,
  ME: 499, MG: 450, MK: 807, ML: 466, MM: 104, MN: 496, MR: 478, MW: 454, MX: 484, MY: 458,
  MZ: 508, NA: 516, NC: 540, NE: 562, NG: 566, NI: 558, NL: 528, NO: 578, NP: 524, NZ: 554,
  OM: 512, PA: 591, PE: 604, PG: 598, PH: 608, PK: 586, PL: 616, PR: 630, PT: 620, PY: 600,
  QA: 634, RO: 642, RS: 688, RU: 643, RW: 646, SA: 682, SB: 90, SD: 729, SE: 752, SG: 702,
  SI: 705, SK: 703, SL: 694, SN: 686, SO: 706, SR: 740, SS: 728, SV: 222, SY: 760, SZ: 748,
  TD: 148, TG: 768, TH: 764, TJ: 762, TL: 626, TM: 795, TN: 788, TR: 792, TT: 780, TW: 158,
  TZ: 834, UA: 804, UG: 800, US: 840, UY: 858, UZ: 860, VE: 862, VN: 704, YE: 887, ZA: 710,
  ZM: 894, ZW: 716,
}

export default function CollaborationMap({ orcidId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    if (!orcidId) return undefined
    let active = true
    setLoading(true)
    setError(null)
    api
      .get('/orcid/collaborations', { params: { orcid_id: orcidId } })
      .then(({ data: d }) => {
        if (active) setData(d)
      })
      .catch(() => {
        if (active) setError('Could not load collaboration data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [orcidId])

  if (!orcidId) return null
  if (loading) return <p className="text-sm text-rhip-muted">Loading collaboration map…</p>
  if (error || !data || !data.countries.length) {
    return <p className="text-sm text-rhip-muted">{error || 'No collaboration data available.'}</p>
  }

  // Build lookup: numeric country id -> collaboration count
  const countByNum = {}
  data.countries.forEach((c) => {
    const num = ALPHA2_TO_NUM[c.country_code]
    if (num) countByNum[parseInt(num, 10)] = c.count
  })
  const maxCount = Math.max(1, ...data.countries.map((c) => c.count))

  const colorFor = (count) => {
    if (!count) return '#E5E7EB'
    const intensity = 0.2 + 0.8 * (count / maxCount)
    return `rgba(13, 148, 136, ${intensity.toFixed(2)})` // rhip teal
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-rhip-dark mb-1">
        Collaboration map
      </h2>
      <p className="text-sm text-rhip-muted mb-3">
        Where this researcher&apos;s co-authors are based, across {data.work_count} works
        {' '}(data from OpenAlex).
      </p>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 150 }}
          style={{ width: '100%', height: 'auto' }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const count = countByNum[parseInt(geo.id, 10)] || 0
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={colorFor(count)}
                    stroke="#FFFFFF"
                    strokeWidth={0.4}
                    onMouseEnter={() => setHover({ name: geo.properties.name, count })}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      default: { outline: 'none' },
                      hover: { fill: '#0d9488', outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      <div className="h-6 mt-1 text-sm text-rhip-body">
        {hover ? (
          <span>
            <strong>{hover.name}</strong>: {hover.count} collaborations
          </span>
        ) : (
          <span className="text-rhip-muted">Hover a country to see collaboration count.</span>
        )}
      </div>

      {/* Top collaborating institutions */}
      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-rhip-muted mb-2">
          Top collaborating institutions
        </p>
        <ul className="space-y-1">
          {data.institutions.slice(0, 8).map((inst) => (
            <li key={inst.name} className="flex items-center justify-between text-sm text-rhip-body">
              <span>
                {inst.name}
                {inst.country_code ? (
                  <span className="text-rhip-muted"> · {inst.country_code}</span>
                ) : null}
              </span>
              <span className="text-rhip-muted">{inst.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}