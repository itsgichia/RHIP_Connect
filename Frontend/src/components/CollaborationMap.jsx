import { useEffect, useMemo, useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
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
const NUM_TO_ALPHA2 = Object.fromEntries(
  Object.entries(ALPHA2_TO_NUM).map(([a2, num]) => [num, a2]),
)

const INITIAL_VIEW = { coordinates: [0, 0], zoom: 1 }

export default function CollaborationMap({ orcidId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hover, setHover] = useState(null)
  const [selected, setSelected] = useState(null) // { code, name }
  const [position, setPosition] = useState(INITIAL_VIEW)

  useEffect(() => {
    if (!orcidId) return undefined
    let active = true
    setLoading(true)
    setError(null)
    setSelected(null)
    setPosition(INITIAL_VIEW)
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

  const countByCode = useMemo(() => {
    const out = {}
    data?.countries.forEach((c) => {
      out[c.country_code] = c.count
    })
    return out
  }, [data])

  if (!orcidId) return null
  if (loading) return <p className="text-sm text-rhip-muted">Loading collaboration map…</p>
  if (error || !data || !data.countries.length) {
    return <p className="text-sm text-rhip-muted">{error || 'No collaboration data available.'}</p>
  }

  const maxCount = Math.max(1, ...data.countries.map((c) => c.count))

  const colorFor = (count) => {
    if (!count) return '#E5E7EB'
    const intensity = 0.2 + 0.8 * (count / maxCount)
    return `rgba(13, 148, 136, ${intensity.toFixed(2)})` // rhip teal
  }

  const zoomIn = () => setPosition((p) => ({ ...p, zoom: Math.min(p.zoom * 1.5, 8) }))
  const zoomOut = () => setPosition((p) => ({ ...p, zoom: Math.max(p.zoom / 1.5, 1) }))
  const resetView = () => setPosition(INITIAL_VIEW)

  const selectedCount = selected ? countByCode[selected.code] || 0 : 0
  const shownInstitutions = selected
    ? data.institutions.filter((i) => i.country_code === selected.code)
    : data.institutions.slice(0, 10)

  const btn =
    'w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded shadow-sm text-rhip-body hover:bg-rhip-lightBg text-base leading-none'

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-rhip-dark mb-1">
        Collaboration map
      </h2>
      <p className="text-sm text-rhip-muted mb-3">
        Countries and institutions this researcher has collaborated with, across{' '}
        {data.work_count} works (data from OpenAlex). Use the buttons to zoom, drag to pan,
        click a country to explore.
      </p>

      <div className="grid md:grid-cols-[1fr_260px] gap-4 items-start">
        {/* Map */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden relative">
          <ComposableMap
            projection="geoEqualEarth"
            projectionConfig={{ scale: 150 }}
            style={{ width: '100%', height: 'auto' }}
          >
            <ZoomableGroup
              center={position.coordinates}
              zoom={position.zoom}
              onMoveEnd={setPosition}
              minZoom={1}
              maxZoom={8}
            >
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const num = parseInt(geo.id, 10)
                    const a2 = NUM_TO_ALPHA2[num]
                    const count = a2 ? countByCode[a2] || 0 : 0
                    const isSelected = selected && a2 === selected.code
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={colorFor(count)}
                        stroke={isSelected ? '#0f766e' : '#FFFFFF'}
                        strokeWidth={isSelected ? 1.2 : 0.4}
                        onMouseEnter={() => setHover({ name: geo.properties.name, count })}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => {
                          if (!a2) return
                          setSelected((prev) =>
                            prev && prev.code === a2
                              ? null
                              : { code: a2, name: geo.properties.name },
                          )
                        }}
                        style={{
                          default: { outline: 'none', cursor: 'pointer' },
                          hover: { fill: '#0d9488', outline: 'none', cursor: 'pointer' },
                          pressed: { outline: 'none' },
                        }}
                      />
                    )
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {/* Zoom controls */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <button type="button" onClick={zoomIn} className={btn} aria-label="Zoom in">
              +
            </button>
            <button type="button" onClick={zoomOut} className={btn} aria-label="Zoom out">
              −
            </button>
            <button
              type="button"
              onClick={resetView}
              className={btn}
              aria-label="Reset view"
              title="Reset view"
            >
              ⟲
            </button>
          </div>

          {/* Legend + hover readout */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-rhip-muted">
              <span>fewer</span>
              <div
                className="h-2 w-24 rounded"
                style={{ background: 'linear-gradient(to right, #E5E7EB, rgb(13,148,136))' }}
              />
              <span>more collaborations</span>
            </div>
            <div className="text-sm text-rhip-body min-h-[1.25rem]">
              {hover && (
                <span>
                  <strong>{hover.name}</strong>: {hover.count} collaborations
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Institutions panel (changes with selected country) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase tracking-wide text-rhip-muted">
              {selected ? `Institutions in ${selected.name}` : 'Top collaborating institutions'}
            </p>
            {selected && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs text-rhip-teal hover:underline"
              >
                Show all
              </button>
            )}
          </div>
          {selected && (
            <p className="text-xs text-rhip-muted mb-2">
              {selectedCount === 0
                ? 'No collaborations with this country.'
                : `${selectedCount} collaboration${selectedCount === 1 ? '' : 's'} here` +
                  (shownInstitutions.length === 0
                    ? ' — institution not among the listed collaborators'
                    : '')}
            </p>
          )}
          {shownInstitutions.length > 0 ? (
            <ul className="space-y-1">
              {shownInstitutions.map((inst) => (
                <li
                  key={inst.name}
                  className="flex items-center justify-between text-sm text-rhip-body"
                >
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
          ) : (
            <p className="text-sm text-rhip-muted">No collaborating institutions here.</p>
          )}
        </div>
      </div>
    </div>
  )
}