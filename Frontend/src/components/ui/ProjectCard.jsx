import { formatAud } from '../../utils/formatters'
import { trlBadgeClass, trlFullLabel, trlShortLabel, trlStageBandLabel } from '../../utils/trl'
import {
  formatIllustrativeMultiple,
  indicativeBandClass,
  indicativeBandLabel,
} from '../../utils/roi'
import { funderBadgeClass, funderLabel } from '../../utils/funder'

export default function ProjectCard({
  project,
  onClick,
  showStage = false,
  showStageBand = false,
  showIndicativeRoi = false,
}) {
  const interactive = Boolean(onClick)
  const funder = funderLabel(project.funder)

  return (
    <button
      type="button"
      onClick={() => onClick?.(project)}
      disabled={!interactive}
      className={`bg-white rounded-2xl p-6 border border-rhip-lightTeal text-left w-full transition-shadow ${
        interactive ? 'hover:shadow-rhip-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-rhip-teal/40' : 'shadow-rhip'
      }`}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${trlBadgeClass(project.trl)}`}>
            {showStageBand ? trlStageBandLabel(project.trl) : trlShortLabel(project.trl)}
          </span>
          {funder && (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${funderBadgeClass(project.funder)}`}>
              {funder}
            </span>
          )}
        </div>
        {showIndicativeRoi && project.indicative_score != null ? (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${indicativeBandClass(
              project.indicative_band
            )}`}
          >
            Score {Math.round(project.indicative_score)}
          </span>
        ) : showStage && project.stage ? (
          <span className="text-xs text-rhip-muted shrink-0">Stage {project.stage}</span>
        ) : (
          <span className="text-xs text-rhip-muted text-right line-clamp-2 max-w-[55%]">
            {showStageBand
              ? `${trlShortLabel(project.trl)} · ${project.trl_label || trlFullLabel(project.trl)}`
              : project.trl_label || trlFullLabel(project.trl)}
          </span>
        )}
      </div>
      <h3 className="font-display font-semibold text-rhip-dark mb-2">{project.title}</h3>
      {project.grant_id && (
        <p className="text-xs text-rhip-muted mb-2 font-mono">{project.grant_id}</p>
      )}
      <p className="text-sm text-rhip-muted line-clamp-3 mb-3">{project.description}</p>
      <div className="flex items-center justify-between text-xs text-rhip-muted">
        <span>{project.specialty_area}</span>
        {project.lead_researcher_name && <span>{project.lead_researcher_name}</span>}
      </div>
      {showIndicativeRoi && project.indicative_score != null && (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span className="text-rhip-muted">{indicativeBandLabel(project.indicative_band)}</span>
          <span className="font-medium text-rhip-dark">
            Illus. {formatIllustrativeMultiple(project.illustrative_multiple)}
          </span>
        </div>
      )}
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
