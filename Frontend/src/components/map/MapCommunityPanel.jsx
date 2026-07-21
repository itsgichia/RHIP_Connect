import { XMarkIcon, UserGroupIcon, LightBulbIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import RoleBadge from '../ui/RoleBadge'

export default function MapCommunityPanel({
  communityView,
  onClose,
  onFocusPerson,
  onStartBridge,
}) {
  if (!communityView) return null

  const roles = Object.entries(communityView.role_mix || {})

  return (
    <aside className="bg-white rounded-2xl border border-rhip-border shadow-sm flex flex-col max-h-[min(720px,80vh)] overflow-hidden">
      <div className="px-5 py-4 border-b border-rhip-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-rhip-muted mb-1">Community</p>
          <h2 className="font-display text-xl font-semibold text-rhip-dark">
            {communityView.name}
          </h2>
          <p className="text-sm text-rhip-muted mt-1 flex items-center gap-1.5">
            <UserGroupIcon className="w-4 h-4" />
            {communityView.member_count}{' '}
            {communityView.member_count === 1 ? 'member' : 'members'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-rhip-muted hover:bg-rhip-lightBg hover:text-rhip-dark transition-colors"
          aria-label="Back to landscape"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-4 overflow-y-auto space-y-5 text-sm">
        {roles.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
              Role mix
            </h3>
            <div className="flex flex-wrap gap-2">
              {roles.map(([role, count]) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rhip-lightBg text-xs text-rhip-body"
                >
                  <RoleBadge role={role} />
                  <span className="text-rhip-muted">{count}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {(communityView.topics || []).length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
              Topics
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {communityView.topics.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-full bg-rhip-cardBg text-rhip-body text-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}

        {(communityView.institutions || []).length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
              Institutions
            </h3>
            <ul className="space-y-1">
              {communityView.institutions.map((inst) => (
                <li key={inst.name} className="flex justify-between gap-2 text-rhip-body">
                  <span className="truncate">{inst.name}</span>
                  <span className="text-rhip-muted shrink-0">{inst.count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(communityView.insights || []).length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
              Opportunities
            </h3>
            <ul className="space-y-2">
              {communityView.insights.map((insight) => (
                <li
                  key={insight.id}
                  className="flex gap-2 rounded-xl bg-rhip-lightTeal/50 border border-rhip-teal/15 px-3 py-2.5"
                >
                  <LightBulbIcon className="w-4 h-4 text-rhip-teal shrink-0 mt-0.5" />
                  <span className="text-rhip-body">{insight.message}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(communityView.bridges_out || []).length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
              Bridges to other communities
            </h3>
            <ul className="space-y-2">
              {communityView.bridges_out.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onFocusPerson?.(b.id)}
                    className="text-left text-rhip-dark font-medium hover:text-rhip-teal truncate"
                  >
                    {b.name}
                  </button>
                  <span className="text-xs text-rhip-muted shrink-0 text-right">
                    → {b.connects_to_community || b.connects_to}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-rhip-muted mb-2">
            Members
          </h3>
          <ul className="space-y-2">
            {(communityView.members || []).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onFocusPerson?.(m.id)}
                  className="text-left min-w-0"
                >
                  <span className="block font-medium text-rhip-dark hover:text-rhip-teal truncate">
                    {m.name}
                  </span>
                  <span className="block text-xs text-rhip-muted truncate">{m.title}</span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <RoleBadge role={m.role} />
                  {onStartBridge && (
                    <button
                      type="button"
                      title="Find bridge from this person"
                      onClick={() => onStartBridge(m.id)}
                      className="p-1 rounded text-rhip-muted hover:text-rhip-teal"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="px-5 py-4 border-t border-rhip-border">
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-rhip-border text-sm font-medium text-rhip-body hover:bg-rhip-lightBg transition-colors"
        >
          Back to landscape
        </button>
      </div>
    </aside>
  )
}
