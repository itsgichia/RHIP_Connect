export default function StatCard({ label, value, unit }) {
  return (
    <div className="bg-rhip-navy rounded-2xl p-6 text-center">
      <p className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
        {value}{unit && <span className="text-lg ml-1">{unit}</span>}
      </p>
      <p className="text-rhip-ice text-sm">{label}</p>
    </div>
  )
}
