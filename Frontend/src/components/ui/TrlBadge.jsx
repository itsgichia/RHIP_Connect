// Technology Readiness Level (TRL) badge.
// Shows a short label per level (words, not "TRL n"), colour-coded per level
// on a warm-to-green gradient (1 = red/early ... 9 = green/market-ready).
// TRL_LABELS (full UNSW definitions) is shown on hover as a tooltip.

const TRL_LABELS = {
  1: 'Basic research',
  2: 'Applied research',
  3: 'Proof of concept',
  4: 'Alpha prototype (lab testing)',
  5: 'Integrated system (lab testing)',
  6: 'Prototype system verified',
  7: 'Integrated pilot demonstrated',
  8: 'Incorporated in commercial design',
  9: 'Proven & ready for commercial deployment',
}

const TRL_SHORT = {
  1: 'Basic research',
  2: 'Applied research',
  3: 'Proof of concept',
  4: 'Lab prototype',
  5: 'Lab validation',
  6: 'Prototype verified',
  7: 'Pilot demonstrated',
  8: 'Commercial design',
  9: 'Market ready',
}

function trlColor(level) {
  const colors = {
    1: 'bg-red-500 text-white',
    2: 'bg-orange-500 text-white',
    3: 'bg-amber-500 text-white',
    4: 'bg-amber-600 text-white',
    5: 'bg-lime-600 text-white',
    6: 'bg-green-500 text-white',
    7: 'bg-green-600 text-white',
    8: 'bg-emerald-600 text-white',
    9: 'bg-emerald-700 text-white',
  }
  return colors[level] || 'bg-gray-400 text-white'
}

export default function TrlBadge({ trl }) {
  if (!trl) return null
  const level = Math.max(1, Math.min(9, Math.round(trl)))
  return (
    <span
      title={`TRL ${level}: ${TRL_LABELS[level]}`}
      className={`px-2 py-1 rounded-full text-xs font-semibold ${trlColor(level)}`}
    >
      {TRL_SHORT[level]}
    </span>
  )
}