export default function StatCard({ label, value, unit, accent = false }) {
  return (
    <div
      className={`rounded-2xl p-5 flex flex-col gap-2 ${
        accent ? 'bg-rhip-coral' : 'bg-rhip-navy'
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-rhip-ice mb-1">
        {label}
      </div>
      <p className="font-display text-3xl md:text-4xl font-bold text-white">
        {value}
        {unit && <span className="text-lg ml-1">{unit}</span>}
      </p>
    </div>
  )
}
