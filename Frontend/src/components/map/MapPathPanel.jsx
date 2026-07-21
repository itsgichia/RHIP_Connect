import { XMarkIcon, LinkIcon } from '@heroicons/react/24/outline'
import RoleBadge from '../ui/RoleBadge'

const EDGE_KIND_LABELS = {
  coauthor: 'Co-authored publication',
  topic_overlap: 'Topic overlap',
}

function edgeKindLabel(kind) {
  if (!kind) return ''
  return EDGE_KIND_LABELS[kind] || kind
}

export default function MapPathPanel({ pathView, onClose, onFocusPerson, onClear }) {
  if (!pathView) return null

  const hops = pathView.hops || []
  const edges = pathView.edges || []

  return (
    <aside className="bg-white rounded-2xl border border-rhip-border shadow-sm flex flex-col max-h-[min(720px,80vh)] overflow-hidden">
      <div className="px-5 py-4 border-b border-rhip-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-rhip-muted mb-1">Bridge</p>
          <h2 className="font-display text-lg font-semibold text-rhip-dark leading-snug">
            {pathView.from?.name}
            <span className="text-rhip-muted font-normal"> → </span>
            {pathView.to?.name}
          </h2>
          <p className="text-xs text-rhip-muted mt-1 capitalize">
            {pathView.found ? `${pathView.kind} path` : 'No path found'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-rhip-muted hover:bg-rhip-lightBg hover:text-rhip-dark transition-colors"
          aria-label="Clear bridge"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-4 overflow-y-auto space-y-5 text-sm">
        <section>
          <p className="text-rhip-body leading-relaxed flex gap-2">
            <LinkIcon className="w-4 h-4 text-rhip-teal shrink-0 mt-0.5" />
            <span>{pathView.summary}</span>
          </p>
        </section>

        {pathView.found && hops.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
              Hops
            </h3>
            <ol className="space-y-3">
              {hops.map((hop, i) => {
                const edge = edges[i]
                return (
                  <li key={`${hop.profile_id}-${i}`}>
                    <button
                      type="button"
                      onClick={() => onFocusPerson?.(hop.profile_id)}
                      className="flex items-center justify-between gap-2 w-full text-left"
                    >
                      <span className="font-medium text-rhip-dark hover:text-rhip-teal truncate">
                        {i + 1}. {hop.name}
                      </span>
                      {hop.role && <RoleBadge role={hop.role} />}
                    </button>
                    {edge && (
                      <p className="text-xs text-rhip-muted mt-1 ml-4">
                        {edge.type === 'real' ? 'Recorded collaboration' : 'Related expertise'}
                        {edge.kind ? ` · ${edgeKindLabel(edge.kind)}` : ''}
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {(pathView.shared_topics || []).length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
              Shared topics
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {pathView.shared_topics.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-full bg-rhip-lightTeal text-rhip-teal text-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}

        {!pathView.found && (
          <p className="text-rhip-muted text-xs">
            This does not mean they should not collaborate, only that the map has no short
            recorded or topical bridge yet.
          </p>
        )}
      </div>

      <div className="px-5 py-4 border-t border-rhip-border flex gap-2">
        <button
          type="button"
          onClick={onClear || onClose}
          className="flex-1 py-2.5 rounded-xl border border-rhip-border text-sm font-medium text-rhip-body hover:bg-rhip-lightBg transition-colors"
        >
          Clear bridge
        </button>
      </div>
    </aside>
  )
}
