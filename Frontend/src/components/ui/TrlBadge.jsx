// Technology Readiness Level (TRL) badge — color-coded 1-9.
// TRL labels follow UNSW's investment glossary. Colour bands give investors a
// quick read: 1-3 early (orange), 4-6 in development (amber), 7-9 ready (green).

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

function trlColor(level) {
  const colors = {
    1: 'bg-orange-100 text-orange-700',
    2: 'bg-orange-100 text-orange-700',
    3: 'bg-amber-100 text-amber-700',
    4: 'bg-amber-100 text-amber-700',
    5: 'bg-yellow-100 text-yellow-700',
    6: 'bg-lime-100 text-lime-700',
    7: 'bg-green-100 text-green-700',
    8: 'bg-green-100 text-green-700',
    9: 'bg-emerald-100 text-emerald-700',
  }
  return colors[level] || 'bg-gray-100 text-gray-700'
}

export default function TrlBadge({ trl }) {
  if (!trl) return null
  const level = Math.max(1, Math.min(9, Math.round(trl)))
  return (
    <span
      title={`TRL ${level}: ${TRL_LABELS[level]}`}
      className={`px-2 py-1 rounded-full text-xs font-semibold ${trlColor(level)}`}
    >
      TRL {level}
    </span>
  )
}