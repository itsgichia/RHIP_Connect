import { formatAud } from '../../utils/formatters'

const READINESS_COLORS = {
  early: 'bg-gray-100 text-gray-600',
  feasibility: 'bg-rhip-lightTeal text-rhip-teal',
  clinical: 'bg-rhip-seafoam/15 text-rhip-seafoam',
  commercial: 'bg-rhip-coral/10 text-rhip-coral',
}

const STAGE_LABELS = {
  1: 'Need', 2: 'Idea', 3: 'PoC', 4: 'Feasibility', 5: 'Proof of Value',
  6: 'Initial Trials', 7: 'Validation', 8: 'Approval', 9: 'Clinical Use', 10: 'Standard of Care',
}

export default function ProjectCard({ project, onClick }) {
  const interactive = Boolean(onClick)

  return (
    <button
      type="button"
      onClick={() => onClick?.(project)}
      disabled={!interactive}
      className={`bg-white rounded-2xl p-6 shadow-sm text-left w-full transition-shadow ${
        interactive ? 'hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-rhip-teal/40' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${READINESS_COLORS[project.readiness] || READINESS_COLORS.early}`}>
          {project.readiness}
        </span>
        <span className="text-xs text-rhip-muted">Stage {project.stage}: {STAGE_LABELS[project.stage]}</span>
      </div>
      <h3 className="font-display font-semibold text-rhip-dark mb-2">{project.title}</h3>
      <p className="text-sm text-rhip-muted line-clamp-3 mb-3">{project.description}</p>
      <div className="flex items-center justify-between text-xs text-rhip-muted">
        <span>{project.specialty_area}</span>
        {project.lead_researcher_name && <span>{project.lead_researcher_name}</span>}
      </div>
      {(project.funding_raised > 0 || project.funding_goal > 0) && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-rhip-muted">Invested</span>
            <span className="font-medium text-rhip-teal">{formatAud(project.funding_raised)}</span>
          </div>
          <div className="h-1.5 bg-rhip-cardBg rounded-full overflow-hidden">
            <div
              className="h-full bg-rhip-teal rounded-full"
              style={{
                width: `${Math.min(
                  project.funding_goal > 0 ? (project.funding_raised / project.funding_goal) * 100 : 0,
                  100
                )}%`,
              }}
            />
          </div>
          {interactive && (
            <p className="text-xs text-rhip-teal mt-2">View details & invest →</p>
          )}
        </div>
      )}
    </button>
  )
}
