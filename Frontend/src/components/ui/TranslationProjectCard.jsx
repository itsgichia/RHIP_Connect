import { formatDuration } from '../../utils/formatters'

const READINESS_COLORS = {
  early: 'bg-gray-100 text-gray-600',
  feasibility: 'bg-rhip-lightTeal text-rhip-teal',
  clinical: 'bg-rhip-seafoam/15 text-rhip-seafoam',
  commercial: 'bg-rhip-coral/10 text-rhip-coral',
}

export default function TranslationProjectCard({ project, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(project)}
      className="bg-white rounded-2xl p-6 shadow-sm text-left w-full hover:shadow-md cursor-pointer transition-shadow focus:outline-none focus:ring-2 focus:ring-rhip-teal/40"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${READINESS_COLORS[project.readiness] || READINESS_COLORS.early}`}>
          {project.readiness}
        </span>
        <span className="text-xs text-rhip-muted">Stage {project.stage}</span>
      </div>
      <h3 className="font-display font-semibold text-rhip-dark mb-2">{project.title}</h3>
      <p className="text-sm text-rhip-muted line-clamp-2 mb-3">{project.description}</p>
      <p className="text-xs text-rhip-body mb-3">{project.translation_status}</p>
      <div className="flex items-center justify-between text-xs text-rhip-muted pt-3 border-t border-gray-100">
        <span>{project.specialty_area}</span>
        <span>{formatDuration(project.duration_months)} active</span>
      </div>
      <p className="text-xs text-rhip-teal mt-2">View translation details →</p>
    </button>
  )
}
