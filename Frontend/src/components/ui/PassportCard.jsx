import TierBadge from './TierBadge'

const TIER_GRADIENTS = {
  none: 'from-rhip-navy to-rhip-dark',
  bronze: 'from-amber-700 to-amber-900',
  silver: 'from-gray-400 to-gray-600',
  gold: 'from-yellow-500 to-amber-700',
}

const TIER_TEXT = {
  none: 'text-rhip-ice',
  bronze: 'text-amber-100',
  silver: 'text-gray-100',
  gold: 'text-yellow-100',
}

function ProgressRing({ attended, total }) {
  const pct = total > 0 ? Math.min(100, (attended / total) * 100) : 0
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <svg width="88" height="88" className="-rotate-90">
      <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
      <circle
        cx="44"
        cy="44"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="text-rhip-teal transition-all duration-700"
      />
    </svg>
  )
}

export default function PassportCard({ tier, eventsAttended, totalEvents, year, pastGold, nextReward }) {
  const tierLabel = tier === 'none' ? 'Member' : tier.charAt(0).toUpperCase() + tier.slice(1)

  return (
    <div className={`rounded-2xl p-8 bg-gradient-to-br ${TIER_GRADIENTS[tier] || TIER_GRADIENTS.none} text-white shadow-lg`}>
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm text-white/70">{year} Precinct Passport</span>
        {pastGold && (
          <span className="text-[10px] px-2 py-0.5 bg-yellow-400/20 text-yellow-200 rounded-full border border-yellow-400/30">
            Past Gold
          </span>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="relative flex items-center justify-center">
          <ProgressRing attended={eventsAttended} total={totalEvents} />
          <span className="absolute text-sm font-bold">{eventsAttended}/{totalEvents}</span>
        </div>
        <div className="flex-1">
          <p className={`font-display text-3xl font-bold ${TIER_TEXT[tier]}`}>{tierLabel}</p>
          <p className="text-white/80 text-sm mt-1">
            {eventsAttended} of {totalEvents} events this year
          </p>
          <div className="mt-3">
            <TierBadge tier={tier} size="lg" />
          </div>
        </div>
      </div>

      {nextReward && (
        <p className="text-sm text-white/80 mt-6 pt-4 border-t border-white/10">{nextReward}</p>
      )}
    </div>
  )
}
