const READINESS_COLORS = {
  early: 'bg-gray-100 text-gray-600',
  feasibility: 'bg-rhip-lightTeal text-rhip-teal',
  clinical: 'bg-rhip-seafoam/20 text-rhip-seafoam',
  commercial: 'bg-rhip-coral/20 text-rhip-coral',
}

const STAGE_LABELS = {
  1: 'Need', 2: 'Idea', 3: 'PoC', 4: 'Feasibility', 5: 'Proof of Value',
  6: 'Initial Trials', 7: 'Validation', 8: 'Approval', 9: 'Clinical Use', 10: 'Standard of Care',
}

export default function ProjectCard({ project }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
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
    </div>
  )
}
